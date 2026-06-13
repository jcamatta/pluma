# Folder rename — frontend (explorer UI)

Wire the already-shipped `folder:rename` backend channel into the explorer: a folder row reveals a
**rename** affordance on hover; clicking it turns the name into an inline field pre-filled with the
current name; Enter commits the new name, Escape cancels. On success the parent listing re-lists with
the new name, and any open descendant folders / the selected file under the renamed subtree have their
paths remapped so the tree and editor stay pointed at the moved content. This is the renderer half of
the feature split — the backend (`folder:rename` contract + use case + adapter + IPC endpoint) shipped
in PR #24 and is on `main`.

## Done

A user can rename a folder in the explorer:

- Hovering a folder row reveals a pencil **rename** button (alongside new-file / new-folder / delete).
- Clicking it replaces the folder name with an inline input pre-filled with the current basename.
- Enter commits → `folder:rename` runs → the row shows the new name; Escape (or empty) cancels with no
  call. A blocked rename (e.g. a sibling of that name already exists → `FolderAlreadyExists`) leaves the
  tree unchanged.
- Open subfolders under the renamed folder stay open under their new paths, and a file selected under
  the renamed folder stays selected (its path remapped), so the editor keeps showing it.
- `npm run lint`, `npm run test` (incl. the e2e audit), `npm run type-coverage`, `npm run build` are
  green, and `npm run test:e2e` passes with a real-app spec that drives a folder rename.

## Steps

Each step is one mini-commit, independently green, within the commit-size budget. The shared IPC
contract (`FOLDER_RENAME_CHANNEL`, `FolderRenameRequest`, `FolderRenameError`) already exists on `main`,
so this plan starts at the renderer port.

1. **Renderer write port + IPC adapter + in-memory fake.** Add `renameFolder(oldPath, newPath) =>
   Promise<Result<string, FolderRenameError>>` to `explorer/ports/folder-writer.port.ts`; implement it in
   `explorer/adapters/folder-repository.ipc.ts` (`window.api.invoke(FOLDER_RENAME_CHANNEL, { oldPath,
   newPath })`, passing the `Result` through unchanged); and add a `renamed`-recording implementation to
   `explorer/__tests__/fake-folder-repository.ts`. These three land together because adding the port
   method breaks the two exact-object implementers until each implements it (same greenness reason the
   backend merged port+adapter). _Delivers:_ the rename seam. _Tests:_ the fake is the test double the
   later hook/UI tests drive; no separate adapter unit test (it is the `window.api` boundary).

2. **Pure subtree-remap calculation.** New `explorer/explorer-subtree-remap.ts` with pure helpers:
   `isUnderOrEqual(path, root)` and `remapPath(path, oldRoot, newRoot)` (replace the `oldRoot` prefix
   with `newRoot`, using the existing separator logic), plus `remapOpenPaths(set, oldRoot, newRoot)`
   returning a new `Set` with every affected path remapped. No React, no IPC — calculations.
   _Tests:_ `explorer/__tests__/explorer-subtree-remap.test.ts` covers exact match, nested descendants,
   unrelated paths untouched, and Windows (`\`) vs POSIX (`/`) separators.

3. **Rename command hook.** New `explorer/useRenameEntry.ts`, mirroring `useDeleteEntry`: a
   `useMutation` over `writer.renameFolder`; on `ok: true` it invalidates the parent's `['folder',
   parent]` listing (never on `ok: false`). Variables `{ oldPath, newPath, parent }`; result is the IPC
   `Result`. _Tests:_ `explorer/__tests__/useRenameEntry.test.tsx` (renderHook over QueryClient +
   fake-repo provider): asserts a successful rename records the call and invalidates the parent listing,
   and that an `ok: false` result does not invalidate.

4. **Tree state + inline-rename UI wiring.** The interactive rename in the renderer, one cohesive commit:
   - `explorer-view-types.ts`: add to `RowContext`/`ExplorerCallbacks` a `renamingPath: string | null`,
     `onStartRename(path)`, `onCommitRename(name)`, `onCancelRename()`, and a `rename` label.
   - `NameInput.tsx`: add an optional `initialValue` (default `''`) so the same inline input serves both
     the create-draft (empty) and rename (pre-filled) cases; focus-select on mount already highlights it.
   - `useExplorerTree.ts`: take `selected` alongside `onSelect`; add `renamingPath` UI state with
     `beginRename`/`cancelRename`; `commitRename(name)` computes `newPath = joinPath(parentPath(old),
     name)` (rename in place — same parent), calls the rename command, and on success remaps `openPaths`
     via `remapOpenPaths` and, if `selected` is under the renamed folder, calls `onSelect(remapPath(...))`.
     A no-op name (unchanged or empty) just cancels.
   - `ExplorerRows.view.tsx`: add a `Pencil` rename `IconButton` to `FolderRow`'s actions; when
     `ctx.renamingPath === node.path`, render `NameInput` (with `initialValue={node.name}`) in place of
     the name span.
   - `Explorer.view.tsx` + `Explorer.controller.tsx`: thread the new label + callbacks; resolve the
     `explorer.rename` string. `i18n/locales/en.json`: add `"rename": "Rename folder"`.
   _Tests:_ extend `Explorer.controller.test.tsx` / `Explorer.view.test.tsx` and
   `useExplorerTree.test.tsx`: starting a rename shows the input with the current name; committing calls
   the writer with the in-place `newPath` and remaps an open child + the selection; Escape cancels with
   no call.

5. **e2e coverage + real-app spec.** Add `'folder.rename'` to `OPERATIONS` in
   `e2e/coverage-manifest.ts` and a real-app spec (extend `e2e/explorer.e2e.ts` or a new
   `folder-rename.e2e.ts`) tagged `@e2e operation:folder.rename`: launch the built app on a temp folder,
   create a folder, rename it via the inline field, assert the row shows the new name and the directory
   moved on disk. Manifest id and spec land in this same commit so the audit stays green.

6. **Remove the plan.** Delete `docs/plans/folder-rename-frontend.md` in its own `docs:` commit
   (performed by `finish-plan`).

## Constraints

- Hexagonal in the renderer: hooks talk to the **port**, never `window.api`; only
  `folder-repository.ipc.ts` touches the bridge. The adapter passes the `Result` through — `ok: false`
  is a value, not a thrown error.
- CQS: rename is a **command** hook (`useMutation` + invalidation), separate from the query hooks.
- Component types: views (`*.view.tsx`) stay hook/IPC-free; the inline input keeps its local state in
  `NameInput` (a plain stateful leaf), the controller resolves labels, the hook owns the side effects.
- Design tokens + Base UI (`Input`, `IconButton`) + Motion + `t()` only; no arbitrary values.
- No new dependencies. Reuse `NameInput`, `folderListingKey`, `joinPath`/`parentPath`.
- e2e drives the real app; the only sanctioned stub is the native folder picker.

## Open questions

- **Editor-follows-rename (verify in step 4/5).** Selection drives the editor, and the editor is now
  per-file (keyed by path). Remapping the selection re-points the editor at the moved file's new path,
  which re-reads the same on-disk content — fine for a saved file. **Risk:** unsaved edits in a buffer
  keyed by the old path could be orphaned by the remap. Proposed scope: remap selection only (the
  minimal correct behavior) and confirm in the e2e/manual pass that a renamed-folder file still opens;
  if buffer-by-path orphaning is real, handle it in a follow-up rather than expanding this plan.
- **File rename is the same slice (optional sibling).** The backend exposed only `folder:rename`; file
  rename would need its own backend channel first. Not in scope here — call out as a future plan, not a
  folded-in step.
- **Rename is in place (SETTLED).** The inline field edits the basename only; `newPath` keeps the
  current parent. No move-across-folders from this UI.
