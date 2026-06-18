# Plan: Back to launcher — leave the open workspace to pick a different folder

## What & why

Once the user opens a folder, Pluma mounts the workspace (Explorer | editor | rail) and there is **no way
back** to the launcher to choose a different workspace short of restarting the app. Add a single
affordance in the open workspace that returns to the launcher screen, so the user can point Pluma at
another folder. This is a renderer-only navigation change — no new IPC, no backend, no new dependency.

## How the screen is decided today (explored — cite these)

- `src/renderer/src/App.tsx` is the **launcher-vs-workspace switch**. It holds `const [root, setRoot] =
useState<string | null>(null)`. When `root === null` it returns `<LauncherController onPicked={setRoot}
/>`; otherwise it renders the workspace shell (line 44). So **navigation = the value of `root`**: a
  non-null path shows the workspace, `null` shows the launcher.
- The launcher hands a path **up** to the shell: `Launcher.controller.tsx` → `useFolderPick(onPicked)`
  (`src/renderer/src/launcher/useFolderPick.ts`) calls the picker port and, on success, invokes
  `onPicked(result.value)`, i.e. `setRoot(path)` in App. A cancelled pick is a no-op.
- There is **no reverse path today.** Nothing ever sets `root` back to `null`. The launcher view
  (`Launcher.view.tsx`) only offers "Open Folder…". The workspace shell never exposes a "leave" control.
- State that lives **under** `root` and is scoped to the open workspace:
  - `App.tsx` `open` (the `OpenFiles` set from `editor/open-files-logic.ts`) — which files are open and
    which is active. Reset to `noOpenFiles` on leave is needed or stale paths from the old folder linger.
  - `usePanels()` (`src/renderer/src/usePanels.ts`) — explorer/rail/settings visibility (defaults
    explorer+rail open). A fresh launcher visit doesn't render these, but a return to a new workspace
    should start from the defaults; `usePanels` already starts open on mount.
  - `AgentProviders cwd={root}` (`src/renderer/src/agent/AgentProviders.tsx` → `AgentProvider.tsx`): the
    Agent is bound to `cwd` via `agent.setCwd(cwd)` in an effect. The whole `AgentProviders` subtree is
    **unmounted** when `root` goes null (it's only rendered in the workspace branch), so its in-memory
    run/thread state is torn down by React automatically.
  - Editor buffers are **disk-wins** (`editor/useEditorFileSync.ts`, autosave) — there is no separate
    unsaved buffer the user could lose; saves are continuous. (Confirm in the open questions below.)
- `RepositoriesProvider` (`src/renderer/src/explorer/RepositoriesProvider.tsx`) and `ThreadsProvider`
  wrap **above** `App` in `src/renderer/src/main.tsx`, so the picker port stays available on the launcher
  — the existing "Open Folder…" path keeps working after a return.

**Conclusion:** the clean return is to lift a `leaveWorkspace()` action in `App.tsx` that sets `root`
back to `null` **and** resets `open` to `noOpenFiles`. React unmounts the workspace subtree (Agent,
editors, rail, explorer), so no manual teardown of agent/editor state is required. The only new UI is one
control to invoke it, placed where the workspace already shows the folder identity: the **Explorer
header** (`Explorer.view.tsx`), next to the "Files" title and the collapse/new-file buttons.

## Design

- **Switch stays where it is.** Keep `root: string | null` as the single source of truth in `App.tsx`.
  Add `leaveWorkspace` that calls `setRoot(null)` and `setOpen(noOpenFiles)` together. Pass it down to the
  Explorer as `onLeave` (the explorer already takes `onClose` for collapse; `onLeave` is a sibling prop).
- **Affordance: a "Change folder" / back button in the Explorer header.** The header
  (`Explorer.view.tsx`, the `border-b` bar) already groups workspace-level controls (new file, new
  folder, collapse). Add an `IconButton` (lucide `FolderOpen` or `ChevronLeft`) with a translated
  `t('explorer.changeFolder')` label that calls `onLeave`. Reuse the existing `IconButton` +
  view/controller pattern; no new layout primitive.
  - **Why the Explorer header, not a global top bar:** the app has no global chrome bar; the Explorer
    header is the only always-present workspace-level control cluster, and "which folder am I in" is an
    explorer concern. (If the explorer is collapsed, the user re-opens it via the existing EdgeTab — out
    of scope to also surface the control on the collapsed edge for v1; noted as an open question.)
- **No confirmation dialog in v1** unless the open questions below settle toward one. With disk-wins
  autosave and an auto-torn-down agent subtree, leaving is non-destructive, so a plain button is honest.
  If an in-flight agent run must be guarded, that becomes its own step (see open questions).

## Steps (each small, independently green, ≤~300 weighted src lines / ≤15 files / code >30 lines lands a test)

1. `[frontend]` Lift the `leaveWorkspace` action in the app shell.
   - `src/renderer/src/App.tsx`: add `const leaveWorkspace = useCallback(() => { setOpen(noOpenFiles);
setRoot(null) }, [])` and thread it into `ExplorerController` as a new `onLeave` prop (wired in the
     next step's controller signature). No visual change yet beyond passing the callback.
   - `src/renderer/src/explorer/Explorer.controller.tsx`: add `onLeave: () => void` to
     `ExplorerControllerProps`, resolve `t('explorer.changeFolder')`, pass both to `ExplorerView`.
   - Because App.tsx and the controller are small wiring edits (<30 changed src lines, no new logic), no
     test file is required for this step on its own; the behavior is covered by step 2's view/controller
     tests and step 3's e2e. (If the slice grows past 30 lines, fold the controller test forward.)

2. `[frontend]` Render the back affordance in the Explorer header + tests + both locales.
   - `src/renderer/src/explorer/Explorer.view.tsx`: add an `IconButton` (lucide icon, e.g. `FolderOpen`)
     in the header control cluster that calls `props.onLeave`, labelled `labels.changeFolder`. Extend
     `ExplorerLabels` / `ExplorerCallbacks` in `explorer-view-types.ts` with `changeFolder` /
     `onLeave`. Design tokens only, Base UI `IconButton`, Motion already in `IconButton`.
   - `src/renderer/src/i18n/locales/en.json` **and** `.../es.json`: add `explorer.changeFolder`
     ("Change folder" / "Cambiar carpeta"). Both locales (parity test).
   - Tests: `Explorer.view.test.tsx` asserts the button renders with the label and clicking it invokes
     `onLeave`; `Launcher`-side is unaffected. Update `Explorer.controller.test.tsx` if it asserts the
     full label set. Keep this step's src delta inside the budget (one button + types + labels).

3. `[e2e]` Real-app spec: open a folder, leave back to the launcher, open a different folder.
   - `e2e/back-to-launcher.e2e.ts` (pattern: an existing launcher/explorer e2e + `e2e/support/
stub-folder-picker.ts`): launch the built app, stub the OS folder picker to a first temp folder,
     click "Open Folder…", assert the workspace (Explorer "Files" header) is shown; click the Explorer
     "Change folder" control, assert the launcher CTA ("Open Folder…") is shown again; stub the picker to
     a **second** temp folder, open it, assert the explorer now lists the second folder's seeded file.
   - Add the manifest id `feature:back-to-launcher` to `e2e/coverage-manifest.ts` in the **same** commit
     as the spec, with the `@e2e feature:back-to-launcher` header tag. This is a user-facing navigation
     feature with no new IPC channel, so it claims a `FEATURES` id, not an `OPERATIONS` id.
   - Use `withTempFolder`-style helpers (no `let`), `await app.close()` in `finally`. Heed the flaky
     temp-folder watcher note — verify against a clean tree before blaming the change.

4. `[docs]` Remove this plan file in its own `docs:` commit once steps 1–3 ship (done by `finish-plan`).

## Done

- In an open workspace, the user can click a clearly-labelled control in the Explorer header to return to
  the launcher screen, then pick a different folder, which mounts that folder's workspace fresh (no files
  from the previous folder remain open).
- Leaving unmounts the Agent/editor/rail subtree (React handles teardown); no stale `root`/`open` state
  leaks across workspaces.
- Green: `npm run lint`, `npm run test` (incl. the e2e coverage audit), `npm run type-coverage`,
  `npm run build`, and `npm run test:e2e` (UI change).

## Constraints

- **Renderer-only, no new IPC, no backend, no new dependency.** The switch already exists (`root` in
  `App.tsx`); this adds a reverse transition and one button.
- **The `root` state stays the single source of truth** for launcher-vs-workspace — do not introduce a
  parallel route/flag. `leaveWorkspace` resets `root` and the workspace-scoped `open` set together so the
  next workspace starts clean.
- View/controller split (`Explorer.view.tsx` stays pure, takes `onLeave`+label as props; the controller
  resolves `t()` and wires the App callback). `*.view.tsx` may not touch `window.api` — it doesn't here.
- Design tokens + Base UI `IconButton` + lucide icon + Motion (already inside `IconButton`); no
  hand-rolled SVG, no arbitrary values. `t()` for the label, in **both** `en.json` and `es.json`.
- e2e drives the **real** app; the only sanctioned stub is the OS folder picker in the main process
  (`stub-folder-picker.ts`). Ship the manifest id and its spec in the same commit.
- Minimal diff / YAGNI — one affordance, one action; do not add a workspace-switcher list, recent-folders,
  or a confirmation dialog unless an open question settles toward it.

## Open questions

- **OPEN — In-flight agent run on leave.** When the user leaves with an agent run streaming, the
  `AgentProviders` subtree unmounts, which tears down the renderer-side run. Is the **backend** run
  cancelled/aborted by that unmount, or does it keep running headless against the old `cwd`? If it must be
  aborted, leaving needs to call the existing abort path first (note: per memory `abortRun` is a no-op in
  the current ag-ui version, so a true abort may not be available). **Resolve before step 1** — it may add
  a guard/confirmation step. Default if unresolved: leave is allowed and the renderer run state is simply
  discarded (no explicit abort), matching today's unmount behavior elsewhere.
- **OPEN — Unsaved editor content on leave.** Editor content is disk-wins with continuous autosave
  (`useEditorFileSync.ts`), so there should be no unsaved buffer to lose. Confirm there is no debounced
  pending write that a sudden unmount could drop; if there is, leaving should flush pending saves first
  (or prompt). Default if unresolved: rely on autosave being already-flushed; no prompt.
- **OPEN — Confirmation dialog?** Given the two answers above, do we want a "Leave this workspace?"
  confirmation, or is a plain button correct? Adding a dialog (Base UI `AlertDialog`, both locales) is a
  separate small step if wanted. Default: no dialog in v1.
- **OPEN — Collapsed-explorer access.** If the explorer panel is collapsed, the back control is hidden
  with it (the user reopens the explorer via the existing EdgeTab to reach it). Acceptable for v1, or
  should the control also live somewhere always-visible (e.g. the editor tab strip's right cluster next to
  Settings)? Default: Explorer header only.
- **OPEN — Icon + label wording.** "Change folder" vs "Back to launcher" vs a back chevron; pick during
  review. Default: `FolderOpen` icon + "Change folder" / "Cambiar carpeta".
