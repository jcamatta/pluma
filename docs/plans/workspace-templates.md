# Plan: Workspace templates — create a new workspace from a starter template

## What & why

Today the launcher has exactly one entry point: **Open Folder** (`useFolderPick` → `picker.pick()` →
`folder:pick` use case → `App` `setRoot`). The user points Pluma at an existing folder and it becomes the
workspace. There is no way to **start a new workspace** with a sensible initial shape.

This plan adds a second launcher entry point — **New from template** — that scaffolds a fresh workspace
folder from a chosen starter template and then opens it exactly like a picked folder (same `onPicked`
path, same `setRoot`). A **template** in v1 is a small, declared starter structure: a set of folders and
seed markdown files, plus an optional project AI-context file. The user picks a parent location (reusing
the native folder picker), names the workspace, and picks one of a few built-in templates; the backend
creates the workspace folder, scaffolds the template's folders/files under it, and returns the new
workspace root path, which the launcher hands to `onPicked`.

The design is deliberately minimal but **extensible**: a template is data (an id + a declared list of
folders and seed files), not code, so adding a richer template later is a data change. The AI-context
seed file is the one concrete hook to the sibling plan `docs/plans/project-ai-context-file.md` (a template
_may_ seed that file); agent **plugins** in a template are explicitly deferred to that plan and
`docs/plans/frontend-ai-plugin-system.md` (see Open questions).

## Scope

- IN (v1):
  - A small set of **built-in templates** declared as data in the application layer: at minimum an
    `empty` template (just the workspace folder) and a `blank-doc` template (workspace folder + one seed
    `*.md`). One template _may_ additionally seed a project AI-context file (a single `*.md`) — gated on
    Open question 2; if unsettled at build time, ship without it.
  - A backend **`scaffoldWorkspace`** use case (command) that, given a parent directory path, a workspace
    name, and a template id, creates the workspace folder and the template's declared folders/files under
    it, then returns the new workspace root absolute path. Composes the **existing** `FolderWriter` /
    `FileWriter` ports — no new filesystem primitives.
  - A new IPC command channel `folder:scaffold` (request: parent path + name + template id; response: the
    new root path; typed errors) and its handler + registration.
  - A renderer **template picker port** + IPC adapter (one `scaffold` call) wired through `useRepos`, and
    a small renderer `useNewWorkspace` command hook that: picks a parent (reuses the existing picker
    port), runs `scaffold`, and on success reports the returned root up via `onPicked`.
  - Launcher UI: a **second action** ("New from template") beside "Open Folder", plus a minimal dialog
    (name field + template choice) — Base UI, Motion, tokens, `t()`, both locales.
  - One real-app e2e: drive "New from template", name a workspace, pick a template, confirm, assert the
    workspace opens (explorer shows the seeded structure) and the files exist on disk.

- OUT (defer — not this plan):
  - **Agent plugins in a template** (declaring/installing plugins as part of scaffolding) — deferred to
    `docs/plans/frontend-ai-plugin-system.md` and Open question 4.
  - **User-defined / custom templates**, template management UI, importing a folder as a template — v1
    ships built-in templates only.
  - **Rich AI-context file authoring** (schema, editing UX) — owned by
    `docs/plans/project-ai-context-file.md`; this plan only _seeds_ a starter file if that plan's shape is
    settled.
  - Non-markdown seed files, nested arbitrary trees beyond the declared template, overwrite/merge into a
    non-empty target (v1 requires a fresh, non-colliding workspace folder; an existing target is a typed
    error).
  - Recent-workspaces / reopen-last — unrelated.

## Anchors (reuse — don't reinvent)

- Launcher entry point: `src/renderer/src/launcher/Launcher.controller.tsx` (wires labels + `onPick`),
  `src/renderer/src/launcher/Launcher.view.tsx` (pure layout; the CTA button), `useFolderPick.ts` (the
  existing pick→`onPicked` command hook — the new hook mirrors its shape). App shell that consumes
  `onPicked`: `src/renderer/src/App.tsx` (`root === null ? <LauncherController onPicked={setRoot} />`).
- Renderer ports + seam: `src/renderer/src/explorer/RepositoriesContext.ts` (`useRepos`; add the template
  port here), `src/renderer/src/explorer/ports/folder-picker.port.ts` (port shape to mirror),
  `src/renderer/src/explorer/adapters/folder-repository.ipc.ts` (the only `window.api` module; add the
  `scaffold` invoke here), `src/renderer/src/explorer/__tests__/fake-folder-repository.ts` (extend the
  fake with the template port for hook/controller/launcher tests).
- Backend use cases to compose: `src/main/application/folder/usecase/create-folder.ts`
  (`createFolder(path) → Effect<string, FolderCreationError, FolderWriterPort>`),
  `src/main/application/file/usecase/create-file.ts` (`createFile(path)`) and
  `src/main/application/file/usecase/write-file.ts` (`writeFile(path, content)` — for a seed file with
  content). Live adapters: `FsFolderWriterLive` (`src/main/adapters/folder/fs-folder-writer.ts`),
  `FsFileWriterLive` (`src/main/adapters/file/fs-file-writer.ts`). Path/extension logic:
  `src/main/application/file/logic/ensure-markdown-extension.ts`, `.../validate-markdown-path.ts`,
  `src/main/application/folder/logic/validate-folder-path.ts`.
- IPC pattern to mirror: shared contract `src/shared/ipc/ipc-contract/folder.ts` (channel const +
  `IpcContractDefinition` + typed error), handler `src/main/ipc/folder/create-folder-handler.ts` (uses
  `runIpc`, provides the live layer + `NodeContext.layer`), registration
  `src/main/ipc/register.ts` (`registerIpc` → `ipcMain.handle(FOLDER_SCAFFOLD_CHANNEL, …)`).
- i18n: `src/renderer/src/i18n/locales/{en,es}.json` under `launcher` (existing keys: `wordmark`,
  `heading`, `description`, `openFolder`, `preview`). Add the new-workspace keys here, **both** locales.
- e2e pattern: a `*.e2e.ts` that drives the real app + `e2e/coverage-manifest.ts` for the manifest id
  (mirror an existing folder/launcher spec; stub the native picker the way the launcher specs do).

## Design: a template is declared data; scaffolding composes existing use cases

Keep all filesystem behavior in the _existing_ file/folder use cases and ports. The new use case is a thin
**orchestrator**: it computes the new workspace root path (`join(parent, name)`), creates that folder via
`createFolder`, then for each declared entry in the template creates a subfolder (`createFolder`) or a
seed file (`createFile` for empty, `writeFile` for one with content) under the root. It returns the root
path. No new `FileWriter`/`FolderWriter` method is introduced.

A template is a value:

```
WorkspaceTemplate = {
  readonly id: string                 // e.g. 'empty' | 'blank-doc'
  readonly folders: readonly string[] // root-relative folder paths to create (may be empty)
  readonly files: readonly {          // root-relative seed files (markdown)
    readonly path: string
    readonly content: string          // '' → created empty; non-empty → written
  }[]
}
```

Built-in templates live as a small data module in the application layer (e.g.
`src/main/application/workspace/templates.ts`) — adding a template is appending a value. The renderer
needs the _list of choosable templates_ (id + a display label key); to avoid a second IPC round-trip and
keep the wire small, the renderer holds its own tiny **template catalog** (id + i18n label key) that must
stay in sync with the backed ids — the scaffold request carries only the chosen `templateId` (a string),
the backend owns what that id scaffolds. (Open question 1 confirms whether the catalog is duplicated
renderer-side or fetched.)

Errors are typed and serialize as bare tagged shapes across IPC (the `Result` boundary): an invalid name
or parent path, a workspace folder that already exists / collides, an unknown template id, and a generic
scaffold failure. The renderer translates each.

## Done

- The launcher shows two actions: **Open Folder** (unchanged) and **New from template**.
- Choosing **New from template** lets the user pick a parent location (native picker, reused), enter a
  workspace name, and pick a built-in template; confirming creates the workspace folder + the template's
  folders/seed files on disk and opens that workspace (same `setRoot` path as opening a folder), with the
  seeded structure visible in the explorer.
- A workspace name that collides with an existing folder, or an unknown template, surfaces a typed,
  translated error and does not open a half-made workspace.
- All strings exist in **both** `en.json` and `es.json` (parity test green).
- `npm run lint`, `npm run test` (incl. the e2e coverage audit), `npm run type-coverage`,
  `npm run build` green; for the UI change, `npm run test:e2e` green for the new spec.

## Steps (each small, independently green, ≤~300 weighted src lines / ≤15 files / code >30 lines lands a test)

1. `[shared]` Scaffold IPC contract.
   - `src/shared/ipc/ipc-contract/folder.ts`: add `FOLDER_SCAFFOLD_CHANNEL = 'folder:scaffold'`, a
     `ScaffoldWorkspaceRequest = { parentPath: string; name: string; templateId: string }`, a
     `ScaffoldWorkspaceError = { _tag: 'InvalidWorkspaceName' | 'WorkspaceAlreadyExists' | 'UnknownTemplate'
| 'WorkspaceScaffoldFailed'; path: string }`, and the `IpcContractDefinition` mapping request → the
     new root `string` → that error. Export them.
   - One-liner additions to an existing contract module; a contract-shape test only if a registry/contract
     enumeration test exists (check `src/main/ipc/__tests__/register.test.ts`); otherwise no new test
     (under the 30-line rule).

2. `[backend]` Templates data + `scaffoldWorkspace` use case + error.
   - `src/main/application/workspace/templates.ts`: the `WorkspaceTemplate` type + the built-in list
     (`empty`, `blank-doc`); a `findTemplate(id)` returning the template or `undefined`. Pure data/calc.
   - `src/main/application/workspace/error/workspace-scaffold-error.ts` (+ the individual tagged errors,
     mirroring the file/folder error modules): `InvalidWorkspaceName` | `WorkspaceAlreadyExists` |
     `UnknownTemplate` | `WorkspaceScaffoldFailed`.
   - `src/main/application/workspace/usecase/scaffold-workspace.ts`:
     `scaffoldWorkspace({ parentPath, name, templateId }) → Effect<string, WorkspaceScaffoldError,
FolderWriterPort | FileWriterPort>` — validates the name (non-empty, no path separators / reserved
     segment), resolves the template (unknown id → `UnknownTemplate`), computes
     `root = join(parentPath, name)`, creates `root` (collision → `WorkspaceAlreadyExists`), then creates
     each template folder and seed file under `root`, and returns `root`. Folder-relative paths are joined
     to `root` here; markdown defaulting reuses `ensureMarkdownExtension`.
   - Tests (`__tests__/scaffold-workspace.test.ts` against fakes of the two writer ports): `empty`
     template creates only the root; `blank-doc` creates root + the seed file with content; unknown id →
     `UnknownTemplate`; colliding root → `WorkspaceAlreadyExists`; blank name → `InvalidWorkspaceName`.
     A small `templates.test.ts` asserting the built-in ids/shape.

3. `[backend]` Scaffold IPC handler + registration.
   - `src/main/ipc/folder/scaffold-workspace-handler.ts`: mirror `create-folder-handler.ts` — `runIpc`
     wrapping `scaffoldWorkspace(req).pipe(Effect.provide(FsFolderWriterLive),
Effect.provide(FsFileWriterLive), Effect.provide(NodeContext.layer))`; `onError`/`onDefect` map to the
     `ScaffoldWorkspaceError` tags.
   - `src/main/ipc/register.ts`: `ipcMain.handle(FOLDER_SCAFFOLD_CHANNEL, (_e, req: ScaffoldWorkspaceRequest)
=> handleScaffoldWorkspace(req))` inside `registerIpc`.
   - Handler test (mirror an existing handler test): success returns the root; a typed error round-trips as
     a `Result` `ok: false`. Update `register.test.ts` if it enumerates channels.

4. `[frontend]` Template/scaffold port + IPC adapter + fake.
   - `src/renderer/src/explorer/ports/workspace-template.port.ts`: `WorkspaceTemplatePort = { scaffold(req:
{ parentPath; name; templateId }) => Promise<Result<string, ScaffoldWorkspaceError>> }` (mirror
     `folder-picker.port.ts`).
   - `src/renderer/src/explorer/adapters/folder-repository.ipc.ts`: add `scaffold: (req) =>
window.api.invoke(FOLDER_SCAFFOLD_CHANNEL, req)`; include the port in the returned object.
   - `src/renderer/src/explorer/RepositoriesContext.ts`: add `templates: WorkspaceTemplatePort` to
     `Repositories`.
   - `src/renderer/src/explorer/__tests__/fake-folder-repository.ts`: add a fake `templates.scaffold`
     (records the request, returns a synthesized root) so launcher/hook tests can drive it. (Touches the
     shared fake — adapter-shaped, low weight; coordinate per the parallel-agents rule.)

5. `[frontend]` `useNewWorkspace` command hook + renderer template catalog.
   - `src/renderer/src/launcher/workspace-templates.ts`: a tiny renderer catalog — `readonly { id: string;
labelKey: string }[]` for the choosable templates (ids mirror the backend; see Open question 1).
   - `src/renderer/src/launcher/useNewWorkspace.ts`: a command hook (mirror `useFolderPick`) reading
     `picker` + `templates` from `useRepos`; exposes `create({ name, templateId })` that picks a parent via
     `picker.pick()` (cancel → no-op), runs `templates.scaffold({ parentPath, name, templateId })`, and on
     `ok` calls `onPicked(root)`; surfaces a typed error to the caller for display. Tests over the fake:
     success → `onPicked(root)`; cancelled pick → no scaffold, no `onPicked`; scaffold error → `onPicked`
     not called, error exposed.

6. `[frontend]` Launcher UI: second action + new-workspace dialog + locales.
   - `src/renderer/src/launcher/Launcher.view.tsx`: add a secondary **New from template** button beside
     **Open Folder** (tokens, Motion, Base UI). Keep it pure — it takes an `onNew` prop.
   - A small dialog (`NewWorkspaceDialog.view.tsx` + `.controller.tsx`, Base UI Dialog): a name field, a
     template choice (radio/select over the renderer catalog labels), Create/Cancel; the controller wires
     `useNewWorkspace.create` and shows a typed error inline. View/controller split.
   - `src/renderer/src/launcher/Launcher.controller.tsx`: own the dialog open state; pass `onNew` to open
     it; render the dialog; keep `onPicked` flowing to `App`.
   - i18n: add to **both** `en.json` + `es.json` under `launcher` (e.g. `newWorkspace`, `dialogTitle`,
     `nameLabel`, `namePlaceholder`, `templateLabel`, `create`, `cancel`, per-template labels, and an
     `errors` block for each tag). Controller/view tests: button opens dialog; Create with a name + template
     calls the hook; an error renders.

7. `[e2e]` Real-app spec + manifest id.
   - `e2e/coverage-manifest.ts`: add `feature:workspace-templates` (manifest id + spec in the **same**
     commit).
   - `e2e/workspace-templates.e2e.ts`: drive the launcher → New from template → name + template → Create
     (stub the native folder picker to a temp parent dir as the launcher specs do), assert the workspace
     opens, the explorer shows the seeded folders/files, and the files exist on disk.

8. `[docs]` Remove this plan file in its own `docs:` commit once all steps ship (`finish-plan` does this).

## Constraints

- Hexagonal: `scaffoldWorkspace` is an application use case depending only on the `FolderWriter` /
  `FileWriter` ports; the IPC handler is the inbound adapter; the live fs layers are the outbound adapters.
  No filesystem access in the use case; no business logic in the handler.
- CQS: scaffolding is a **command** (mutating) — its own use case, distinct from the read/query channels.
- The IPC `Result` boundary holds: typed errors serialize as bare tagged shapes; nothing throws across
  IPC; the renderer treats `ok: false` as a value.
- `adapters/` may not import `src/shared` (lint-enforced). If the use case needs the template ids and the
  renderer needs labels, the renderer catalog (step 5) is a small local mirror — do **not** import an
  application/shared constant into a renderer/main adapter; mirror the literal (Open question 1).
- v1 templates are **markdown + folders only** (reuse `ensureMarkdownExtension`/`validateMarkdownPath`); no
  binary/asset seeds.
- v1 requires a **fresh, non-colliding** workspace folder — a collision is `WorkspaceAlreadyExists`, never
  an overwrite/merge.
- No new dependency (path joining via the existing platform/node context already used by the fs adapters).
  No `as` casts / `@ts-ignore` / `eslint-disable` / non-null `!` — fix the code or ask.
- Frontend: tokens-only, Base UI, Motion, `t()` for every string, both locales, view/controller split,
  `Scrollable` for any overflow.
- Minimal diff. Do not change the existing **Open Folder** flow (`useFolderPick` / `folder:pick`); the new
  flow is additive and lands its root through the same `onPicked` seam.

## Open questions

1. **Where the choosable-template list lives.** Proposed v1: the renderer holds a tiny catalog (id +
   i18n label key) mirroring the backend ids, and the request carries only `templateId`; the backend owns
   what each id scaffolds. Alternative: a `folder:list-templates` query so the renderer never duplicates
   the ids. Leaning on the mirror (one fewer channel, ids are stable) — confirm. **open**
2. **Project AI-context seed file.** Whether a built-in template seeds a project AI-context file depends on
   the shape settled in `docs/plans/project-ai-context-file.md` (the file's name/location/initial content).
   If that plan is settled when this builds, add a template variant that seeds it; if not, ship `empty` +
   `blank-doc` only and add the AI-context template as a follow-up. **open — depends on
   `project-ai-context-file.md`**
3. **Template set + names for v1.** Proposed `empty` ("Empty workspace") and `blank-doc` ("Single
   document"). Confirm the exact built-in templates, their seeded structure, and the writer-facing labels
   (don't invent product scope). **open**
4. **Agent plugins in a template.** Explicitly deferred: a template declaring/installing agent plugins
   depends on `docs/plans/frontend-ai-plugin-system.md`. Out of scope here; revisit once that system
   exists. **deferred**
5. **Workspace name → folder name rules.** Proposed: the name is used verbatim as the folder name,
   validated for non-empty + no path separators / reserved segments (reuse `validate-folder-path` logic),
   collision → `WorkspaceAlreadyExists`. Confirm whether the name should be slugified vs. used as-is.
   **open**
