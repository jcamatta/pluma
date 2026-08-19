# Plan: Drag-and-drop in the explorer to MOVE files/folders into folders

## What & why

The explorer can create / rename / delete entries, but there is no **move**: a writer can't reorganise
their workspace by dropping a file or folder into a different folder. This adds **HTML5 drag-and-drop**
to the file tree — pick up a row, drop it onto a folder row (or the root), and the entry moves there on
disk and re-lists under its new parent.

A move is, at the filesystem level, **a rename whose parent directory changes and whose basename is
preserved** — `FsFileWriterLive.renameFile` / `FsFolderWriterLive.renameFolder` already call
`fs.rename(source, destination)` and already reject an occupied destination
(`FileAlreadyExists` / `FolderAlreadyExists`). So the backend work is small (a dedicated, intent-named
**move** seam over the existing writers, see Open question Q1), and the bulk of the feature is the DnD
UX in the renderer plus coalescing the **watcher-event burst** a move triggers.

## Anchors (reuse these — don't reinvent)

Backend (`src/main`):

- File rename: `application/file/usecase/rename-file.ts` (validates `.md` on both paths via
  `logic/validate-markdown-path.ts`, delegates to `port/file-writer.port.ts`). Live adapter
  `adapters/file/fs-file-writer.ts` — `renameFile` = `fs.rename` with a destination-exists guard.
- Folder rename: `application/folder/usecase/rename-folder.ts` (validates via
  `logic/validate-folder-path.ts`). Live adapter `adapters/folder/fs-folder-writer.ts` — `renameFolder`
  = `fs.rename`, destination-exists guard.
- IPC: `ipc/file/rename-file-handler.ts`, `ipc/folder/rename-folder-handler.ts`, registered in
  `ipc/register.ts` (`FILE_RENAME_CHANNEL`, `FOLDER_RENAME_CHANNEL`).
- Wire contract: `shared/ipc/ipc-contract/file.ts` (`FileRenameRequest`, `FileRenameError`),
  `shared/ipc/ipc-contract/folder.ts` (`FolderRenameRequest`, `FolderRenameError`).
- Watcher: `adapters/folder/parcel-folder-watcher.ts` → `FileEvent` stream →
  `ipc-event-contract/folder.ts` (`FOLDER_CHANGED_CHANNEL`, `FolderChange`).

Renderer (`src/renderer/src/explorer/`):

- Writer port already has `renameFile` / `renameFolder`: `ports/folder-writer.port.ts`; real adapter
  `adapters/folder-repository.ipc.ts`; in-memory fakes `__tests__/fake-folder-repository.ts`.
- Tree state + the **subtree-remap a move needs already exists**:
  `useExplorerTree.ts` `commitRename` calls `remapOpenPaths` / `remapPath` / `isUnderOrEqual` from
  `explorer-subtree-remap.ts` after a successful rename. Path math: `explorer-tree.ts`
  (`joinPath`, `parentPath`).
- Command side: `useExplorerCommands.ts` (owns the writer mutations **and** the watcher `onChange`
  invalidation — the burst lives here), `useRenameEntry.ts` (the rename command hook), query keys
  `folder-query-keys.ts` (`folderListingKey`).
- View: `Explorer.view.tsx`, recursive rows `ExplorerRows.view.tsx` (`FolderRow` / `FileRow`), shared
  prop shapes `explorer-view-types.ts` (`RowContext`, `ExplorerCallbacks`, `ExplorerLabels`),
  controller `Explorer.controller.tsx` (resolves `t()` labels).
- i18n: `i18n/locales/en.json` + `es.json`, `explorer.*` block.
- e2e: `e2e/explorer.e2e.ts` (`@e2e feature:explorer`, drives the real app + asserts disk via `onDisk`),
  manifest `e2e/coverage-manifest.ts`.

## Done

A writer can drag any file or folder row and drop it onto a different folder row — or onto the explorer
root — and the entry moves into that folder: it disappears from its old parent, appears under the new
one (with its open/selection state preserved for a moved folder subtree), and the move is reflected on
disk. Dropping onto a folder that already contains an entry of that name is rejected and the tree is
unchanged. The drop target is highlighted while dragging over it; an invalid drop (onto self, into own
descendant, or onto the current parent) shows no drop affordance and is a no-op. A move that produces a
filesystem-watcher burst re-lists each affected folder **once**, not once per raw event.

Green: `npm run lint`, `npm run test` (incl. the e2e coverage audit), `npm run type-coverage`,
`npm run build`; for the UI `npm run test:e2e`.

## Steps

Each step is one small, independently green commit (≤~300 weighted `src/` lines / ≤15 files; code over
30 lines lands a test).

### 1. `[frontend]` Pure move-target validation logic + tests

Add `src/renderer/src/explorer/explorer-move-target.ts` — pure path math (no React, no IPC), a sibling
to `explorer-subtree-remap.ts`:

- `moveDestination(sourcePath, targetFolder)`: the new path = `joinPath(targetFolder, basename(source))`
  (basename via the existing separator-aware helpers in `explorer-tree.ts`).
- `isValidMoveTarget({ sourcePath, sourceType, targetFolder })`: `false` when the target equals the
  source's current parent (no-op), when `targetFolder === sourcePath`, or when `targetFolder` is under
  the source (a folder dropped into its own descendant) — reuse `isUnderOrEqual` from
  `explorer-subtree-remap.ts`. `true` otherwise.

Tests in `explorer/__tests__/` cover: a sibling move, drop-onto-self, drop-into-own-descendant,
drop-onto-current-parent (no-op), and POSIX + Windows separators (mirror the dual-separator tests
already in `explorer-subtree-remap`).

Delivers the move's business rules as a unit-testable calculation before any DnD wiring.

### 2. `[frontend]` `useMoveEntry` command hook + tests

Add `src/renderer/src/explorer/useMoveEntry.ts`, modelled on `useRenameEntry.ts`. It wraps
`useMutation`; `mutationFn` branches on `type` and calls `writer.renameFolder` / `writer.renameFile`
with `(oldPath, newDestination)` — **reusing the existing rename ports/channels** (see Q1). On
`ok: true` it invalidates **both** the source parent's and the destination folder's
`folderListingKey(...)` (a move changes two listings, unlike rename which changes one); never on
`ok: false`. Returns the `Result` unchanged (`ok: false` is a value the caller branches on).

Tests (`renderHook` + `QueryClientProvider` + `RepositoriesProvider` with the in-memory fake): a
successful move resolves `ok: true` and invalidates both parents; a rejected move
(`FileAlreadyExists` / `FolderAlreadyExists`) resolves `ok: false` and invalidates nothing. Extend
`__tests__/fake-folder-repository.ts` only if the fake doesn't already record rename calls usably.

Delivers the data path with no UI yet.

### 3. `[frontend]` Coalesce the watcher-event burst in `useExplorerCommands`

A move emits a delete burst at the source parent and a create burst at the destination parent
(recursively, for a folder) — today `useExplorerCommands.onChange` calls `invalidateQueries` once **per
raw event**. Replace the per-event invalidation with a **debounced/coalesced** flush: accumulate the
distinct affected parent paths from the burst and invalidate each affected `folderListingKey` once after
a short quiet window. Keep the existing root-scoping (`parent.startsWith(root) ? parent : root`).

Extract the coalescing as a pure helper `src/renderer/src/explorer/folder-change-batch.ts`
(prev→next accumulation of a path Set + the set of keys to flush) so it's unit-testable without timers
in the hook, per the Data/Calc/Action split; tests cover dedup of repeated paths and root-scoping. The
hook owns only the timer (Action). No module-level mutable state — accumulate via the state container /
a ref-held timer, per the no-module-state rule.

Independent of steps 1–2; delivers the burst mitigation the user flagged.

### 4. `[frontend]` Move wiring in `useExplorerTree` (drag state + `commitMove`)

Extend `useExplorerTree.ts`:

- Wire `useMoveEntry` through `useExplorerCommands` (add a `move(...)` to `ExplorerCommands`, mirroring
  `rename`).
- Add drag UI state: `draggingPath: string | null` and `dropTargetPath: string | null` (root = `root`).
- `commitMove(targetFolder)`: compute the destination with `moveDestination`, guard with
  `isValidMoveTarget` (no-op + clear drag state when invalid), call `move({ type, oldPath, newPath,
sourceParent, destParent })`, and **on success reuse the rename remap** — `remapOpenPaths` /
  `remapPath` for the open-set and selection, exactly as `commitRename` already does (a moved folder
  keeps its expanded children and the selected file follows). Auto-open the destination folder so the
  moved entry is visible (mirror `beginCreate`'s `withPath`).
- Expose `draggingPath`, `dropTargetPath`, `onDragStart(path)`, `onDragEnter(targetFolder)`,
  `onDragEnd()`, `commitMove` from the hook.

Tests extend `__tests__/useExplorerTree.test.tsx`: a valid drop calls `move` and remaps open/selection;
an invalid drop (self / descendant / same-parent) does not call `move`.

If this step approaches the budget, split the hook drag-state from the `ExplorerCommands.move` plumbing
into 4a/4b.

### 5. `[frontend]` DnD affordances in the rows + view + labels (both locales)

Thread the drag handlers and drag state through `explorer-view-types.ts` (`RowContext` /
`ExplorerCallbacks` gain `draggingPath`, `dropTargetPath`, `onDragStart`, `onDragEnter`, `onDragEnd`,
`onDropMove`) and `Explorer.view.tsx` → `Explorer.controller.tsx`:

- `ExplorerRows.view.tsx`: make `FileRow` and `FolderRow` `draggable`; on `FolderRow` (and the root
  container in `Explorer.view.tsx`) handle `onDragEnter` / `onDragOver` (preventDefault to allow drop) /
  `onDrop` → `commitMove(targetFolder)`. Highlight the row when `dropTargetPath === node.path` using a
  **design-token** style (reuse the selection emphasis pattern already in `FileRow`, e.g. the
  `border-action-primary` treatment — no new token, no arbitrary value). Dim the dragged row.
- Animate the drop-target highlight and the dragged-row dim with **Motion** (`motion/react`) per the
  reduced-motion rule; consult `docs/motion.dev.react.llms.txt` first. No Tailwind `transition-*` mixed
  with Motion.
- Add accessible labels for any new control surface and the drop hint to `explorer.*` in **both**
  `en.json` and `es.json` (e.g. `explorer.moveHere` / `explorer.moving`). Views stay pure (no hooks);
  the controller resolves every `t()` label into `labels`, as it already does.

Tests: `ExplorerRows.view.test.tsx` / `Explorer.view.test.tsx` assert rows are `draggable`, that
`onDrop` on a folder fires `onDropMove` with the target, and that the highlight class appears when
`dropTargetPath` matches.

### 6. `[e2e]` Real-app move spec + manifest operation

This ships **no new IPC channel** (it reuses `file:rename` / `folder:rename`), so it adds **operations**,
not a feature id, to keep the audit honest:

- Add `file.move` and `folder.move` to `OPERATIONS` in `e2e/coverage-manifest.ts` **only in this step**,
  and claim them with `@e2e operation:file.move operation:folder.move` in a new spec. (If a reviewer
  prefers not to mint synonym operation ids for the rename channels, claim the move under
  `feature:explorer` in `explorer.e2e.ts` instead and drop the manifest additions — see Q2.)
- New `e2e/explorer-move.e2e.ts` (pattern: `e2e/explorer.e2e.ts`): seed a temp folder with a file and a
  subfolder, drive a real drag of the file row onto the subfolder row (Playwright
  `dragTo` / `dispatchEvent` for HTML5 DnD), then assert the row appears under the new parent, the old
  row is gone, and the move landed on disk (`onDisk(oldPath) === false`, `onDisk(newPath) === true`).
  Add a rejected-conflict case (drop onto a folder already holding that name → tree unchanged, both
  paths still on disk). Use `withTempFolder`, `stubFolderPicker`, `await app.close()` in `finally`.

Manifest id(s) + spec in the **same** commit (audit rule).

### 7. `[backend]` (CONDITIONAL on Q1) dedicated move use cases/ports

**Only if Q1 resolves to "name the intent."** Add `application/file/usecase/move-file.ts` and
`application/folder/usecase/move-folder.ts` that compute the destination from `(sourcePath,
targetFolder)` and delegate to the existing writer ports' `renameFile` / `renameFolder` (no new port
methods — `fs.rename` already moves). Add `file:move` / `folder:move` channels + handlers + wire
contracts + register, and point the renderer adapter/port at them. Each use case >30 lines lands its
`__tests__`. If Q1 resolves to "reuse rename," this step is dropped and steps 2/6 stand as written.

This step is sequenced last because it only swaps the seam the renderer already drives; deferring the
decision doesn't block the UX steps.

### 8. `[docs]` Remove this plan file in its own `docs:` commit once every step has shipped.

## Constraints

- **Hexagonal + CQS.** Move is a **command**; the move hook invalidates only on `ok: true`. The hook
  talks to the writer **port** (`useRepos`), never `window.api`; only the adapter touches IPC.
- **IPC `Result` boundary.** `ok: false` (e.g. `FileAlreadyExists`) is a value the UI branches on and
  maps to a `t()` key by `_tag` — never a throw, never rendered raw.
- **No new dependency.** HTML5 DnD is native (`draggable` / `dataTransfer` / `onDrop`); no DnD library.
- **Tokens / Base UI / Motion / i18n.** Highlight uses existing tokens (no arbitrary bracket values,
  no invented token); interactive UI uses Base UI primitives where one exists; animation via
  `motion/react` with reduced-motion; every string in **both** `en.json` and `es.json`.
- **No DOM-tree reaching.** Drag state flows through props/`RowContext`, not `querySelector`.
- **No module-level mutable state** in the watcher-coalescing (step 3) — accumulate via state/ref.
- **Minimal diff / YAGNI.** Reuse `renameFile` / `renameFolder` and the existing remap helpers; don't
  add a folder DnD library or generalise beyond move-into-folder.
- **Watcher burst** is the named risk: a move fires a delete-burst + create-burst (recursive for
  folders); step 3 coalesces invalidations so each affected listing refreshes once.

## Open questions

- **Q1 — Dedicated `move` use case/port vs. reuse `rename`? (open, blocks step 7; steps 2/6 assume
  reuse).** At the fs level move == rename (`fs.rename`), and `renameFile`/`renameFolder` already guard
  the occupied destination, so reuse is the minimal-diff path and needs **no** backend change. The
  prompt asks to "design the missing backend move use case/port," which argues for naming the intent
  (`moveFile`/`moveFolder` + `file:move`/`folder:move` channels) even though they'd delegate to the same
  writer methods. **Default in this plan: reuse `rename`** (no backend step) with step 7 as the
  opt-in if we want the intent named. Pick one before implementation.
- **Q2 — e2e claim: new `file.move`/`folder.move` operation ids, or claim under `feature:explorer`?**
  Tied to Q1: reusing the rename channels means no _new_ channel, so minting `*.move` operation ids is
  arguably synonym-inflation; claiming the move under the existing `explorer` feature spec is leaner.
  Step 6 defaults to adding the ids; confirm the preference. (If Q1 = dedicated channels, the new
  operation ids are required.)
- **Q3 — `.md`-only constraint on a moved file.** `renameFile` validates `.md` on both paths; a move
  preserves the basename so this always holds for files the explorer lists (it only lists `.md`). No
  action needed unless we later allow moving non-`.md` files (out of scope). Noting for the record.
- **Q4 — Cross-root / outside-workspace drops.** This plan only supports dropping within the open root.
  Dropping onto the root container moves to the workspace root; dropping outside the explorer is a
  no-op. Confirm no drag-out-to-OS behaviour is expected (assumed out of scope).
- **Q5 — Multi-select move.** v1 moves **one** entry per drag (mirrors create/rename/delete, which are
  single-entry). Batch/multi-select move is out of scope; confirm.
