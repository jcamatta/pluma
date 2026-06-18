# Plan: Recent workspaces on the launcher

## What & why

The launcher today offers exactly one action — **Open Folder…** (`Launcher.controller.tsx` →
`useFolderPick` → native dialog → `App.tsx` `setRoot`). A user who works across a few folders must
re-pick from the OS dialog every time. This feature adds a **recent workspaces** list on the launcher:
the folders the user has opened before, newest first, each with **Open** and **Remove**. Picking or
opening a folder records it; the list survives restarts.

Nothing persisted for app-level state exists today (settings live in renderer `localStorage`; threads
live in the Claude SDK session store). Recents are app-global, not workspace-scoped, so they need a
**new backend persistence store**: a single JSON file under Electron's `userData` directory, owned by
the main process, exposed over two new IPC channels (`recents:list` query, `recents:record` /
`recents:remove` commands). The launcher reads/writes it through renderer ports, mirroring the threads
feature's reader/writer/ports/adapter/context/query+command-hook shape.

## Done

When shipped, a user can:

- Open the app and, beside the Open Folder call-to-action, see a **Recent** list of folders they have
  opened before (newest first), each showing its folder name and full path.
- Click a recent entry's **Open** to enter that workspace without the OS dialog.
- Click a recent entry's **Remove** to drop it from the list (does not touch the folder on disk).
- Pick a brand-new folder via Open Folder; it appears at the top of the list next time the launcher
  shows.
- See the list empty cleanly (just the call-to-action) on first run.
- Have the list persist across app restarts.

Green: `npm run lint`, `npm run test` (incl. the e2e coverage audit), `npm run type-coverage`,
`npm run build`, and (UI change) `npm run test:e2e`.

## Anchors (reuse these shapes; don't reinvent)

- Launcher today: `src/renderer/src/launcher/Launcher.controller.tsx`,
  `Launcher.view.tsx`, `WorkspacePreview.tsx`, `useFolderPick.ts`. App shell wiring:
  `src/renderer/src/App.tsx` (`root` state, `<LauncherController onPicked={setRoot} />`).
- Folder-pick IPC end-to-end (model for a new query/command channel): shared contract
  `src/shared/ipc/ipc-contract/folder.ts` + registry `src/shared/ipc/ipc-contract/index.ts`; handler
  `src/main/ipc/folder/pick-folder-handler.ts`; registration `src/main/ipc/register.ts`
  (`registerIpc`); use case `src/main/application/folder/usecase/pick-folder.ts`; port
  `src/main/application/folder/port/folder-picker.port.ts`; live adapter
  `src/main/adapters/folder/electron-folder-picker.ts`; `runIpc` wrapper
  `src/main/ipc/shared/run-ipc.ts`; the `Result` boundary `src/shared/ipc/ipc-result.ts`.
- Renderer feature shape to mirror (a list query + commands + invalidation + ports/adapter/context/
  provider): the **threads** feature — `src/renderer/src/threads/` (`useThreads.ts`,
  `useDeleteThread.ts`, `threadKeys.ts`, `ThreadsContext.ts`, `ThreadsProvider.tsx`,
  `adapters/threads-repository.ipc.ts`, `ports/threads-reader.port.ts`,
  `ports/threads-writer.port.ts`, `__tests__/fake-threads-repository.ts`). Renderer picker port for
  reference: `src/renderer/src/explorer/ports/folder-picker.port.ts` and adapter
  `src/renderer/src/explorer/adapters/folder-repository.ipc.ts`.
- Main entry / `app.whenReady`: `src/main/index.ts` (where `userData` is available). Preload bridge:
  `src/preload/index.ts` (typed by `src/shared/ipc/window-api.ts` — no edit needed; it's derived from
  the contract registry).
- i18n: `src/renderer/src/i18n/locales/en.json` + `es.json` (`launcher.*` block at line ~69).
- e2e manifest: `e2e/coverage-manifest.ts` (FEATURES + OPERATIONS).

## Steps (each small, independently green, ≤~300 weighted src lines / ≤15 files / code >30 lines lands a test)

1. `[shared]` Recents IPC contract.
   - `src/shared/ipc/ipc-contract/recents.ts` (new): channel constants `RECENTS_LIST_CHANNEL =
'recents:list'`, `RECENTS_RECORD_CHANNEL = 'recents:record'`, `RECENTS_REMOVE_CHANNEL =
'recents:remove'`; wire types `RecentWorkspace = { readonly path: string; readonly name: string;
readonly openedAt: number }`, a `RecentsError = { _tag: 'RecentsReadFailed' | 'RecentsWriteFailed' }`,
     and the three `IpcContractDefinition` types — `list` (input `void`, value
     `ReadonlyArray<RecentWorkspace>`), `record` (input `string` path, value
     `ReadonlyArray<RecentWorkspace>`), `remove` (input `string` path, value
     `ReadonlyArray<RecentWorkspace>`). Commands return the new list so the renderer can update
     without a second round-trip.
   - `src/shared/ipc/ipc-contract/index.ts`: add the three contracts to the `IpcContract` union.
   - No test (type-only contract; the registry compiles or it doesn't).

2. `[backend]` Recents application core: data, errors, port, use cases.
   - `src/main/application/recents/data/recent-workspace.ts`: the domain `RecentWorkspace` shape (path,
     name, openedAt).
   - `src/main/application/recents/error/recents-read-failed.ts`, `recents-write-failed.ts`: tagged
     errors (Data.TaggedError), matching the wire `_tag`s.
   - `src/main/application/recents/port/recents-store.port.ts`: `RecentsStorePort` (Context.GenericTag)
     — `read(): Effect<ReadonlyArray<RecentWorkspace>, RecentsReadFailed>`,
     `write(list): Effect<void, RecentsWriteFailed>`.
   - `src/main/application/recents/logic/record-recent.ts`: **pure** calc
     `recordRecent(list, path, name, now) → ReadonlyArray<RecentWorkspace>` — move/insert `path` to the
     front (dedupe by path, newest first), cap to **MAX_RECENTS** (Open question A). + test.
   - `src/main/application/recents/usecase/list-recents.ts` (query: read via port),
     `record-recent-workspace.ts` (command: read → `recordRecent` → write → return new list),
     `remove-recent.ts` (command: read → filter out path → write → return new list). + use-case tests
     against a fake `RecentsStorePort`.
   - CQS: `list` is a query; `record`/`remove` are commands. Derive `name` from `path` with a small
     pure helper (basename) so the use case stays logic-only.

3. `[backend]` Recents persistence adapter + IPC handlers + registration.
   - `src/main/adapters/recents/json-recents-store.ts`: `JsonRecentsStoreLive` (Layer) implementing
     `RecentsStorePort` over a JSON file at `join(app.getPath('userData'), 'recent-workspaces.json')`.
     `read` returns `[]` when the file is missing (first run), maps a parse/IO failure to
     `RecentsReadFailed`; `write` serializes the list, maps IO failure to `RecentsWriteFailed`. Only
     this file touches `fs`/`app.getPath`. Mirror `electron-folder-picker.ts`'s `Effect.tryPromise` +
     `Layer.succeed` style. + test against a real temp dir (read-missing → `[]`; write then read
     round-trips; write failure → tagged error).
   - `src/main/ipc/recents/list-recents-handler.ts`, `record-recent-handler.ts`,
     `remove-recent-handler.ts`: each `runIpc({ channel, effect: useCase(...).pipe(provide(
JsonRecentsStoreLive)), onError, onDefect })`. Mirror `pick-folder-handler.ts`.
   - `src/main/ipc/register.ts`: register the three channels inside `registerIpc` (stateless
     command/query channels, like folder/file).
   - Handler tests live with the use-case/adapter tests; the handler files themselves are thin
     (<30 lines each) — no separate handler test required beyond the audit's reach.

4. `[frontend]` Recents renderer ports + IPC adapter + context/provider + fake.
   - `src/renderer/src/recents/ports/recents-reader.port.ts` (`list()`),
     `recents-writer.port.ts` (`record(path)`, `remove(path)`) — return the IPC `Result` shapes from
     the shared contract.
   - `src/renderer/src/recents/adapters/recents-repository.ipc.ts`: implement both ports over
     `window.api.invoke(RECENTS_*_CHANNEL, …)`. **Only** file here that touches `window.api` (per the
     adapters-only rule). Mirror `threads-repository.ipc.ts`.
   - `src/renderer/src/recents/RecentsContext.ts` (`useRecentsRepo`, invariant guard) +
     `RecentsProvider.tsx` (builds the real repo once in state). Mirror `ThreadsContext`/
     `ThreadsProvider`.
   - `src/renderer/src/recents/__tests__/fake-recents-repository.ts`: in-memory fake for hook/UI tests.
   - Wrap the launcher subtree (or `App`) in `RecentsProvider` so the launcher can read it; the
     launcher renders before a workspace exists, so the provider sits above `LauncherController` in
     `App.tsx`. (Add the provider here; the launcher consumes it in step 6.)
   - Ports/context are <30 lines; the adapter + fake are covered by the hook tests in step 5.

5. `[frontend]` Recents query + command hooks.
   - `src/renderer/src/recents/recentsKeys.ts`: `recentsKey() = ['recents']` (app-global, no cwd).
   - `src/renderer/src/recents/useRecents.ts`: `useQuery` keyed `recentsKey()`, `queryFn` → reader
     `list()`. Mirror `useThreads.ts`.
   - `src/renderer/src/recents/useRecordRecent.ts`: `useMutation` → writer `record(path)`; on `ok`
     invalidate `recentsKey()`.
   - `src/renderer/src/recents/useRemoveRecent.ts`: `useMutation` → writer `remove(path)`; on `ok`
     invalidate `recentsKey()`. Mirror `useDeleteThread.ts`.
   - Tests for each hook against the fake repo (list returns rows; record/remove invalidate; `ok:false`
     does not).

6. `[frontend]` Launcher UI: recent list + Open/Remove, and record-on-open.
   - `src/renderer/src/launcher/RecentWorkspaces.view.tsx` (new, pure): renders the list — each row a
     folder name + path with **Open** and **Remove** actions; an empty list renders nothing (or a
     muted "no recents" line — Open question C). Design tokens, Base UI, Motion entrance consistent
     with `Launcher.view.tsx`, `lucide-react` icons (Folder / X), `t()` labels. No hand-rolled SVG.
   - `Launcher.view.tsx`: add an optional recents slot/region beside the call-to-action (keep the
     responsive drop of `WorkspacePreview` intact); pass `recents`, `onOpen(path)`, `onRemove(path)`
     as props (view stays hook-free).
   - `Launcher.controller.tsx`: call `useRecents()`, `useRemoveRecent()`; on a successful pick
     (`useFolderPick`) and on opening a recent, call `useRecordRecent().record(path)` **then**
     `onPicked(path)`. Resolve all new `t()` labels. The controller owns the order: record the path,
     then enter the workspace.
   - `useFolderPick.ts`: unchanged seam, but the controller now records before calling `onPicked`.
     (Alternatively record inside `onPicked` in `App.tsx` — Open question B settles where the record
     call lives so a folder opened by ANY future path is captured.)
   - i18n: add `launcher.recentTitle`, `launcher.recentOpen`, `launcher.recentRemove`,
     `launcher.recentEmpty` (if used) to **both** `en.json` and `es.json`.
   - Tests: `RecentWorkspaces.view.test.tsx` (renders rows, fires Open/Remove); update
     `Launcher.controller.test.tsx` (records on pick; opens a recent) and `Launcher.view.test.tsx`.

7. `[e2e]` Manifest ids + real-app spec.
   - `e2e/coverage-manifest.ts`: add FEATURE `recent-workspaces` and OPERATIONS `recents.list`,
     `recents.record`, `recents.remove`.
   - `e2e/recent-workspaces.e2e.ts` (new, `@e2e` header claiming the feature + the three operations):
     drive the real app — open a folder via the dialog, return to the launcher (or restart the window),
     assert the folder now appears in Recent, click Open to re-enter it, then Remove to drop it.
     Pattern: an existing real-app spec (`e2e/settings.e2e.ts` / `e2e/artifacts.e2e.ts`). Manifest ids
     - spec in the **same** commit.

8. `[docs]` Remove this plan file in its own `docs:` commit once all steps ship (done by `finish-plan`).

## Constraints

- **Hexagonal / CQS.** `list` is a query, `record`/`remove` are commands, each its own use case and
  on the read vs write split of the port. No business logic in adapters or IPC handlers; the recents
  ordering/dedupe/cap rule lives in the pure `recordRecent` calc. IPC handlers are inbound adapters
  that run a use case and serialize via `runIpc`.
- **The `Result` boundary holds.** Effect types never cross IPC; errors serialize as bare `_tag`
  strings; nothing throws across IPC. Commands return the updated list (a value), and `ok: false` is a
  value the renderer branches on, not a thrown error.
- **New persistence is opt-in-scoped.** The only new store is one JSON file under `userData`; no new
  dependency (use Node `fs` + Electron `app`, both already available). If a store library is desired,
  that needs approval — default is the hand-rolled JSON file (matches the no-new-deps rule).
- **Renderer rules.** Only `recents/adapters/recents-repository.ipc.ts` references `window.api`; hooks
  read ports via `useRecentsRepo`. View/controller split (view is hook-free). Design tokens, Base UI,
  Motion, `t()` for every string, **both** locales (parity test). No hand-rolled SVG (lucide-react).
- **Minimal diff / YAGNI.** Don't restyle the launcher beyond adding the recents region; keep the
  responsive `WorkspacePreview` drop behavior. Don't add workspace metadata beyond path/name/openedAt.

## Open questions (resolve before the steps that depend on them)

- **A — list cap & ordering.** `recordRecent` orders newest-first and dedupes by path. What is
  **MAX_RECENTS** (e.g. 5, 8, 10)? And is "newest first" by last-opened (move existing entry to front
  on re-open) the intended ordering? _Blocks step 2 (`recordRecent` calc + its test)._ — **open**
- **B — where the record call lives.** Record on a successful pick **and** when opening a recent. Should
  the `record(path)` call live in `Launcher.controller.tsx` (only launcher-initiated opens recorded) or
  in `App.tsx`'s `onPicked` (every workspace entry recorded, regardless of source)? _Blocks step 6._ —
  **open**
- **C — removal of folders that no longer exist on disk.** When listing recents, should the app verify
  each path still exists and silently drop (or visually mark) missing folders, or always show every
  recorded entry and let the user Remove stale ones manually? Verifying existence means the store/use
  case touches `fs.stat` per entry. _Blocks step 6's empty/missing handling and possibly step 2/3._ —
  **open**
- **D — empty-state copy.** Does the launcher show a muted "No recent folders yet" line when the list is
  empty, or render nothing beside the call-to-action? _Affects whether `launcher.recentEmpty` exists._
  — **open**
