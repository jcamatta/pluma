# Workspace open flow: open the first file, model the no-file state

Replace the dead-end "untitled" editor with an honest open flow.

Today, opening a project always shows a blank editor bound to `path=null`. It looks writable, but autosave is gated off when `path === null` (`useAutoSave.ts:19`), so anything typed there is silently discarded the moment a real file is selected — a data-loss trap. Two changes fix this:

1. **Open into a real file when one exists.** On project open, auto-select the first `.md` file at the root level (alphabetical, files only).
2. **Model "no file open" as an explicit empty state.** When the root has no `.md` file, the editor area shows a proper empty-state view (localized copy pointing the user to the explorer's "New file"), not a phantom editor. Nothing to type into means nothing to lose.

This deliberately supersedes two earlier designs: lazy "untitled" materialization (promotion logic, name collisions) and an auto-created `Welcome.md` (resurrects on every reopen of an empty workspace unless we persist per-workspace "already welcomed" state, which we don't have). The empty state is also exactly what the future tab UI needs when the user closes every tab, so it is groundwork, not throwaway.

## Done

When shipped:

- Opening a project that contains `.md` files at the root lands the user directly in the first one (alphabetical, files only), already editable and autosaving — no manual click.
- Opening a project with no root-level `.md` file shows a localized empty state in the editor area instead of a writable phantom editor; creating a file from the explorer then opens it in the editor as today.
- It is impossible to type content that never persists: every editor the user can type into is bound to a real file path.
- `npm run lint`, `npm run test` (incl. the e2e coverage audit), `npm run type-coverage`, `npm run build` all green, and `npm run test:e2e` green for the flows below.

## Constraints

- **Renderer-only; no new IPC, no new deps.** Reuse the explorer's `useFolderListings`, `folderListingKey`, `joinPath`, `sortEntries`; reads via the reader port only (this feature performs no writes).
- **Calculations stay pure and unit-tested**, separate from the React/IO that calls them (`firstMarkdownFile`).
- **`useAutoSave` and `Editor.controller` are not changed.** The empty state replaces `EditorStack`'s `path=null` branch; the controller's own `path=null` handling stays as-is (minimal diff).
- **Empty-state copy is translation-scoped** (`editor.empty.*` keys in `en.json`), uses design tokens only, view is a pure `*.view.tsx` (props in, layout out — no hooks).
- **Settings stay reachable.** Today the untitled editor's top bar carries the settings button; the empty state must keep an equivalent affordance (it receives `onOpenSettings` as a prop) so no-file workspaces don't lose access.
- **Lint limits**: `max-params` ≤ 2, no `let`/`as`/escape hatches, one export per file.
- New code lives in the **editor** feature (`src/renderer/src/editor/`), which already imports from the explorer feature — no new cross-feature boundary.

## Steps

### 1. `firstMarkdownFile` calculation

- **Add** `src/renderer/src/editor/first-markdown-file.ts` — pure calc `firstMarkdownFile(entries: readonly FolderEntry[]): string | null`. Reuses `sortEntries` for stable order, filters to `type === 'file'` whose name ends in `.md`, returns the first basename or `null`.
- **Add** `src/renderer/src/editor/__tests__/first-markdown-file.test.ts` — covers: picks first md alphabetically, ignores directories, ignores non-md files, returns `null` for an empty/`.md`-less listing.

### 2. `useInitialFileSelection` hook + App wiring

- **Add** `src/renderer/src/editor/useInitialFileSelection.ts` — `useInitialFileSelection(root: string | null): void`. Reads the root listing via `useFolderListings(root ? [root] : [])` (React Query dedupes with the explorer's identical query — no extra IPC). In an effect, once the listing resolves, sets a `useRef` guard synchronously so it fires **once per root**; if `firstMarkdownFile(entries)` finds a name, calls `useOpenFiles().open(joinPath(root, name))`. No-op while root is null, while loading, or when there is no md (the empty state then shows).
- **Add** `src/renderer/src/editor/__tests__/useInitialFileSelection.test.tsx` — `renderHook` with in-memory fake repos (`ReposHarness`/`createFakeFolderRepository`) and a fake `OpenFilesContext`: a seeded folder opens its first md; an md-less folder opens nothing; fires once across re-renders.
- **Add** `src/renderer/src/editor/InitialFileBridge.tsx` — headless component (returns `null`, calls the hook with `root`; pattern: `EditorToolsBridge`), needed because the hook reads `useOpenFiles()` from inside the provider. **Edit** `src/renderer/src/App.tsx` to mount it.
- Lands green: purely additive; with no md at root the app behaves exactly as today (untitled branch still in place until step 3).

### 3. Empty-state view replaces the untitled branch

- **Edit** `src/renderer/src/i18n/locales/en.json` — add `editor.empty.*` keys: a short heading ("No file open"–style) and a hint pointing to the explorer's New file button. (`editor.untitled` stays — `editorFileName` still uses it as the generic fallback.)
- **Add** `src/renderer/src/editor/EditorEmptyState.view.tsx` — pure view: centered heading + hint (tokens: `text-text-muted` etc.), plus the settings affordance the untitled top bar used to provide (`settingsLabel`, `onOpenSettings` props). All text via props so the view stays hook-free; the controller-side strings come from `t` at the call site.
- **Edit** `src/renderer/src/editor/EditorStack.tsx` — the `open.active === null` branch renders `EditorEmptyState` (receiving `t`-derived strings and `onOpenSettings` from props it already has) instead of `EditorController path={null}`.
- **Add/extend** `src/renderer/src/editor/__tests__/EditorEmptyState.view.test.tsx` — renders with props, asserts heading/hint/settings button; extend the existing EditorStack coverage if present so `active === null` renders the empty state and a non-null active still renders editors.
- After this step the phantom writable editor is gone.

### 4. e2e coverage

- **Edit** `e2e/coverage-manifest.ts` — add feature id `workspace-open` to `FEATURES` (no new operations: this feature only reads `folder.list`, already covered).
- **Add** `e2e/workspace-open.e2e.ts` (tag: `@e2e feature:workspace-open`), real-app tests via the folder-picker stub:
  1. **Opens the first md on project open** — temp folder seeded with two `.md` files; after picking the folder, the editor shows the alphabetically-first file's content and its name in the top bar with no manual click; type and poll `readFile` to confirm autosave targets that file.
  2. **No-md project shows the empty state** — temp folder seeded empty; after picking the folder, the empty-state heading is visible and no `.ProseMirror` surface exists; create a file via the explorer's New file flow and assert the editor opens it (the today-path still works end to end).
- e2e files and the manifest are weight 0; this commit ships the audit id and its spec together so the gate stays green.

### 5. Remove the plan (docs)

- **Delete** `docs/plans/workspace-open-flow.md` as its own `docs:` commit once every step is shipped and green (performed by `finish-plan`).

## Open questions

- **SETTLED — first file ordering**: alphabetical, files only, root level only (no recursion). Reuses `sortEntries`.
- **SETTLED — no-md workspace**: explicit empty state, no auto-created file. Supersedes both the lazy-untitled design (promotion + collision logic) and the `Welcome.md` design (would resurrect after delete + reopen without per-workspace persistence).
- **DEFERRED — welcome/onboarding file**: revisit once a per-workspace app-state store exists (so "first open ever" is knowable); the empty state's copy can carry lightweight onboarding hints in the meantime.
- **DEFERRED — close-all-tabs**: the future tab UI will reuse this same empty state when the user closes every file; no extra modeling needed now.
- **Empty-state copy**: exact wording lands in step 3; English only (`en.json` is the only locale), keys scoped under `editor.empty.*`.
