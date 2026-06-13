# Rename file

Let the user rename a markdown file from the explorer, the same way folder rename already works. The
backend mirrors the shipped `folder:rename` channel exactly (validate both paths → move on disk →
typed `Result`). The renderer reuses the rename machinery that already shipped for folders — the
`useRenameEntry` hook, the tree's `renamingPath`/`beginRename`/`commitRename`/`cancelRename` state,
the `onStartRename`/`onCommitRename`/`onCancelRename` view callbacks, and the pre-fillable
`NameInput` — making it **type-aware** (file vs directory) just like create and delete already are,
and adding the rename affordance to the file row.

Rename is a **name change within the same folder**, not a move (YAGNI); the new name must be a
non-empty `.md` path under the same parent. On a conflict or any failure the UI behaves exactly like
folder rename does today: it exits rename mode and the row keeps its old name (no special conflict
UX).

## Done

- A user with a folder open can hover a file row, click "Rename file", edit the name inline
  (pre-filled, text selected), press Enter, and the file is renamed on disk; the row re-lists with
  the new name and, if the file was open in the editor, selection follows the new path. Escape/blur
  cancels.
- Each typed failure (`InvalidPath`, `FileNotFound`, `FileAlreadyExists`, `FileRenameFailed`) is a
  `Result` value the renderer branches on (no throw across IPC).
- `npm run lint`, `npm run test` (incl. the e2e coverage audit), `npm run type-coverage`, and
  `npm run build` are green at every step; `npm run test:e2e` is green after the e2e step.

## Steps

Order follows the dependency direction (shared contract → backend inner-to-outer → renderer →
e2e), so each step lands green on what came before. Backend mirrors the matching `rename-folder`
file noted in parentheses.

### 1. Shared IPC contract for `file:rename` — done

- `src/shared/ipc/ipc-contract/file.ts` (edit) — add `FILE_RENAME_CHANNEL = 'file:rename'`, a
  `FileRenameRequest { oldPath; newPath }`, a `FileRenameError` with
  `_tag: 'InvalidPath' | 'FileNotFound' | 'FileAlreadyExists' | 'FileRenameFailed'` and `path`, and a
  `FileRenameContract` (mirror of `FolderRenameContract` in `folder.ts`); add all four to the export
  block.
- `src/shared/ipc/ipc-contract/index.ts` (edit) — import `FileRenameContract` and add it to the
  `IpcContract` union, so the preload bridge and main handlers see the channel automatically.

Type-only, no test (mirrors the untested folder contract types).

### 2. Application: rename-file use case (+ error + port) — done (committed with step 3)

- `src/main/application/file/error/file-rename-failed.ts` (new) — `FileRenameFailed` tagged error
  with `{ path }` (mirror `folder-rename-failed.ts`).
- `src/main/application/file/error/file-rename-error.ts` (new) — `FileRenameError` union:
  `InvalidPath | FileNotFound | FileAlreadyExists | FileRenameFailed` (mirror
  `folder-rename-error.ts`; the first three already exist under `application/file/error/`).
- `src/main/application/file/port/file-writer.port.ts` (edit) — add
  `renameFile(oldPath, newPath): Effect<void, FileNotFound | FileAlreadyExists | FileRenameFailed>`
  to `FileWriterPort`.
- `src/main/application/file/usecase/rename-file.ts` (new) — validate `oldPath` and `newPath` with
  the existing `validateMarkdownPath`, then delegate to `FileWriter.renameFile`, returning the
  validated new path (mirror `rename-folder.ts`, swapping `validateFolderPath` for
  `validateMarkdownPath`).
- `src/main/application/file/usecase/__tests__/rename-file.test.ts` (new) — success plus each typed
  failure, against an in-memory `FileWriter`.

### 3. Adapter: `fs-file-writer.renameFile` — done

> Note: steps 2 and 3 landed in one commit — adding `renameFile` to `FileWriterPort` breaks every
> implementer (the adapter and the existing create/delete/write use-case test fakes), so the port,
> the use case, the adapter, and the test-fake stubs had to land together to stay green.

- `src/main/adapters/file/fs-file-writer.ts` (edit) — add `renameFile(source, destination)`: source
  must be an existing **File** else `FileNotFound`; an occupied destination → `FileAlreadyExists`;
  any other `fs.rename` failure → `FileRenameFailed`; add `renameFile` to the returned
  `FileWriter.of({...})` (mirror `renameFolder` in `fs-folder-writer.ts`, swapping the `Directory`
  check for `File` and the folder errors for the file ones).
- `src/main/adapters/file/__tests__/fs-file-writer.rename.test.ts` (new) — against a real temp dir:
  renames a file, reports a missing/non-file source, refuses an existing destination (mirror
  `fs-folder-writer.rename.test.ts`).

### 4. IPC endpoint + registration — done

> Note: registering the new handler pushed `registerIpc` to 13 statements (max 12), so the file
> channels were extracted into a `registerFileChannels` helper (mirroring `registerThreadChannels`).

- `src/main/ipc/file/rename-file-handler.ts` (new) — `handleRenameFile({ oldPath, newPath })` runs
  the `rename-file` use case with `FsFileWriterLive` and serializes the outcome to
  `Result<string, FileRenameError>` via the shared `runIpc` wrapper (mirror
  `rename-folder-handler.ts`).
- `src/main/ipc/file/__tests__/rename-file-handler.test.ts` (new) — serialization of success and
  each error tag.
- `src/main/ipc/register.ts` (edit) — import the handler + `FILE_RENAME_CHANNEL` and register
  `ipcMain.handle(FILE_RENAME_CHANNEL, (_event, request: FileRenameRequest) => handleRenameFile(request))`.

After this step the backend `file:rename` channel is fully shipped and green, with no UI yet.

### 5. Renderer: `renameFile` on the writer port + adapter + fake

- `src/renderer/src/explorer/ports/folder-writer.port.ts` (edit) — add
  `renameFile(oldPath, newPath): Promise<Result<string, FileRenameError>>` to `FolderWriterPort`,
  alongside the existing `renameFolder`.
- `src/renderer/src/explorer/adapters/folder-repository.ipc.ts` (edit) — implement `renameFile` as
  `window.api.invoke(FILE_RENAME_CHANNEL, { oldPath, newPath })`, passing the `Result` through
  unchanged (mirror the `renameFolder` line).
- `src/renderer/src/explorer/__tests__/fake-folder-repository.ts` (edit) — implement `renameFile`
  recording into the existing `renamed` bucket (so the fake satisfies the grown port and rename tests
  can assert file renames).

Port + adapter are ~3 lines; the fake is test-weight 0. Real adapter and fake implement the new
method in the same step so the port stays satisfied and the tree green.

### 6. Renderer: make rename type-aware (file or folder)

The shipped rename path is generic over a path but hardcodes the folder op. Make it branch on
`type`, exactly as `useCreateEntry`/`useDeleteEntry` already do.

- `src/renderer/src/explorer/useRenameEntry.ts` (edit) — add `type: 'file' | 'directory'` to
  `RenameVariables`; `mutationFn` branches `directory → writer.renameFolder`, `file →
writer.renameFile`; widen `RenameResult` error to `FileRenameError | FolderRenameError`. Parent
  invalidation is unchanged (`folderListingKey(parent)` works for both).
- `src/renderer/src/explorer/useExplorerCommands.ts` (edit) — add `type` to the `rename` args type;
  the wrapper passes it straight through.
- `src/renderer/src/explorer/useExplorerTree.ts` (edit) — `commitRename` passes
  `type: findType(tree, path) ?? 'file'` (the helper already used by `remove`) into `rename`. The
  existing open-paths/selection remap is left as-is: for a file it correctly no-ops the open-set and,
  when the renamed file is the selected one, remaps selection to the new path.
- Tests (edit/add) — update `__tests__/useRenameEntry.test.tsx` and `__tests__/useExplorerTree.test.tsx`
  to pass `type` and add a file-rename branch (rename invoked via `renameFile`, parent invalidated on
  `ok: true`, selection follows the renamed file).

Folder rename behavior is unchanged (`type: 'directory'`); this only adds the file branch.

### 7. Renderer: rename affordance on the file row + i18n

- `src/renderer/src/explorer/explorer-view-types.ts` (edit) — add a `renameFile` string to
  `ExplorerLabels`. The `onStartRename`/`onCommitRename`/`onCancelRename` callbacks and `renamingPath`
  already on `RowContext` are reused as-is.
- `src/renderer/src/explorer/ExplorerRows.view.tsx` (edit) — `FileRow` gains a rename `IconButton`
  (`Pencil`, label `ctx.labels.renameFile`, `onClick={() => ctx.onStartRename(node.path)}`); when
  `ctx.renamingPath === node.path`, render `NameInput` (`initialValue={node.name}`,
  `onCommit={ctx.onCommitRename}`, `onCancel={ctx.onCancelRename}`) in place of the name span —
  mirroring `FolderRow`.
- `src/renderer/src/explorer/Explorer.controller.tsx` (edit) — resolve `renameFile: t('explorer.renameFile')`
  in the labels object.
- `src/renderer/src/i18n/locales/en.json` (edit) — add `explorer.renameFile` (`"Rename file"`).
- `src/renderer/src/explorer/__tests__/Explorer.view.test.tsx` (edit) — assert the file row exposes a
  rename button and that entering rename mode shows the inline input pre-filled with the file name.

After this step file rename is fully usable in the running app.

### 8. e2e coverage

- `e2e/coverage-manifest.ts` (edit) — add `'file.rename'` to `OPERATIONS`.
- `e2e/explorer.e2e.ts` (edit) — add `@e2e operation:file.rename` and a real-app test (mirror the
  folder rename test): seed a `.md` file, click its "Rename file" action, fill a new name, press
  Enter, and assert the row now shows the new path, the old one is gone, and the file moved on disk.

### 9. Remove the plan

Delete `docs/plans/rename-file.md` as its own `docs:` commit (handled by the `finish-plan` skill).

## Constraints

- **Layering**: IPC → application; the adapter is wired at the edge. The use case depends only on the
  `FileWriter` port. The renderer touches `window.api` only in `folder-repository.ipc.ts`.
- **CQS**: rename is a command — `useRenameEntry` wraps `useMutation` and invalidates the parent
  listing on success; it never returns a query.
- **`Result` boundary**: every endpoint returns `Result`; `ok: false` is a value, never thrown. Each
  error carries a `_tag`.
- **No new deps.** `Pencil` is already used by `FolderRow` from `lucide-react`.
- **UI parity**: design tokens + Base UI `Input` (via `NameInput`) + `t()`; keep the file rename
  affordance visually identical to the folder one.
- **Mirror, don't fork**: extend the existing generic rename to be type-aware rather than adding a
  parallel file-only hook, matching how create/delete already branch on `type`.
- **Commit budget**: every step is well under ~300 weighted `src/` lines and ≤15 files; code over 30
  lines lands with a test. If step 6 or 7 ever trips the hook, split hook-vs-tree (6) or
  button-vs-input (7).
- **Rename is in-place**: the new name stays under the same parent and must be a non-empty `.md`
  path; moving to another folder is out of scope.

## Open questions

None blocking — this is a direct mirror of the shipped folder rename. (If we later want a
move-to-another-folder gesture or an inline conflict message on `FileAlreadyExists`, those are
separate follow-ups; folder rename doesn't have them either.)
