# Plan: Copy & paste files/folders in the explorer

## What & why

A writer can already create / rename / delete files and folders in the explorer, but cannot
**duplicate** one. This adds copy & paste: select a file or folder, copy it (Ctrl+C or a row action),
then paste it into a target folder (Ctrl+V or a row action). Folders copy **recursively** (all
descendants). When the paste target would collide with an existing entry, the new entry is given a
non-colliding name (e.g. `notes (copy).md`) rather than failing or overwriting.

The work mirrors the existing create/rename/delete verticals exactly — a new backend "copy" use case
per kind (file, folder) behind the existing writer ports, a new IPC channel per kind, a renderer
clipboard store + paste command hook, and a real-app e2e. No business logic lives outside the
application layer; the adapters only touch disk.

## Anchors (reuse these shapes; don't invent new ones)

Backend (file):

- Port: `src/main/application/file/port/file-writer.port.ts` (`FileWriterPort` — add `copyFile`).
- Adapter: `src/main/adapters/file/fs-file-writer.ts` (`FsFileWriterLive` — the only file disk I/O).
- Use case to mirror: `src/main/application/file/usecase/create-file.ts` /
  `rename-file.ts`; path validation `application/file/logic/validate-markdown-path.ts`,
  `ensure-markdown-extension.ts`.
- Errors (Data.TaggedError, `{ path }`): `application/file/error/*` — e.g. `file-already-exists.ts`,
  `file-not-found.ts`, `file-write-failed.ts`.
- IPC handler to mirror: `src/main/ipc/file/rename-file-handler.ts` (uses `runIpc`,
  `Effect.provide(FsFileWriterLive)`, `Effect.provide(NodeContext.layer)`).
- Registration: `src/main/ipc/register.ts` → `registerFileChannels()`.

Backend (folder):

- Port: `src/main/application/folder/port/folder-writer.port.ts` (`FolderWriterPort` — add
  `copyFolder`). Reader (for descendants if needed): `folder/port/folder-reader.port.ts`.
- Adapter: `src/main/adapters/folder/fs-folder-writer.ts` (`FsFolderWriterLive`). Note
  `fs.remove(target, { recursive: true })` is already used here — the platform `FileSystem` exposes a
  recursive `copy`; the recursive copy primitive lives in this adapter, never in the use case.
- Use case to mirror: `application/folder/usecase/create-folder.ts` / `rename-folder.ts`; validation
  `folder/logic/validate-folder-path.ts`. Errors: `folder/error/*`.
- IPC handler to mirror: `src/main/ipc/folder/rename-folder-handler.ts`; registration in
  `register.ts` → `registerIpc()`.

Shared contract:

- `src/shared/ipc/ipc-contract/file.ts` and `folder.ts` (channel const + request/error interfaces +
  `IpcContractDefinition`), joined into the union in `src/shared/ipc/ipc-contract/index.ts`. The
  preload bridge (`src/preload/index.ts`) is generic over the union — **no per-channel preload edit**.

Renderer:

- Ports: `src/renderer/src/explorer/ports/folder-writer.port.ts` (add `copyFile`/`copyFolder`).
- IPC adapter (only place touching `window.api`): `explorer/adapters/folder-repository.ipc.ts`.
- In-memory fakes: `explorer/__tests__/fake-folder-repository.ts`, `fake-window-api.ts`.
- Command hooks to mirror: `explorer/useRenameEntry.ts` / `useCreateEntry.ts` / `useDeleteEntry.ts`
  (wrap `useMutation`, invalidate `folderListingKey(parent)` on `ok: true`).
- Tree/command orchestration: `explorer/useExplorerCommands.ts`, `useExplorerTree.ts`
  (CQS: tree/read state vs. write commands). Path helpers: `explorer/explorer-tree.ts`
  (`joinPath`, `parentPath`).
- View/controller + row actions: `Explorer.controller.tsx`, `Explorer.view.tsx`,
  `ExplorerRows.view.tsx`, `explorer-view-types.ts` (labels/callbacks/RowContext),
  `components/IconButton.tsx`.
- i18n: `src/renderer/src/i18n/locales/en.json` + `es.json` (`explorer.*`).

e2e:

- Manifest: `e2e/coverage-manifest.ts` (`OPERATIONS`). Spec to mirror: `e2e/explorer.e2e.ts`
  (`launchApp`, `stubFolderPicker`, `withTempFolder`, on-disk assertions).

## Scope

- IN: copy + paste of a **file** and a **folder** (folder recursive) within the open workspace;
  clipboard is single-entry, renderer-side; collision-safe naming on paste; keyboard (Ctrl+C/Ctrl+V)
  and/or a row action button (see open questions); one real-app e2e per kind.
- OUT (not this plan): **cut/move** (only copy), multi-select clipboard, cross-window/OS-clipboard
  integration, copy across different workspace roots, pasting OS-clipboard image/text, undo.

## Steps (each small, independently green, ≤~300 weighted src lines / ≤15 files / code >30 lines lands a test)

1. `[backend]` File copy: port method + adapter + non-colliding-name logic.
   - `application/file/port/file-writer.port.ts`: add
     `copyFile(source: string, destination: string) => Effect<void, FileNotFound | FileAlreadyExists | FileWriteFailed>`.
   - `adapters/file/fs-file-writer.ts`: implement `copyFile` — source must be an existing regular file
     (else `FileNotFound`), destination already occupied → `FileAlreadyExists`, any other copy failure
     → `FileWriteFailed` (mirror `renameFile`'s stat/exists/mapError structure, using the platform
     `FileSystem` copy/copyFile primitive). Update the in-test fakes used by the rename/delete adapter
     tests as needed.
   - `application/file/logic/derive-copy-name.ts` (+ `__tests__`): a pure calc that, given a basename
     and the set of sibling names, returns a non-colliding basename per the agreed rule (see Open
     question Q1 — defaults to `name (copy).ext`, then `name (copy 2).ext`, …). Unit-tested in
     isolation. **Blocked on Q1.**

2. `[backend]` `copyFile` use case + tests.
   - `application/file/usecase/copy-file.ts`: validate source & destination via
     `validateMarkdownPath` (mirror `rename-file.ts`), delegate to `writer.copyFile`, return the
     validated destination. Fail with a typed `FileCopyError` union (add an
     `error/file-copy-error.ts` alias mirroring `file-rename-error.ts` over `InvalidPath | FileNotFound
| FileAlreadyExists | FileWriteFailed`).
   - `usecase/__tests__/copy-file.test.ts`: success path; invalid source/destination → `InvalidPath`
     without touching the writer; each writer error propagates. Mirror `__tests__/rename-file.test.ts`
     (in-memory `FileWriter` fake — extend the fake to include `copyFile`).

3. `[shared]` File copy IPC contract.
   - `src/shared/ipc/ipc-contract/file.ts`: add `FILE_COPY_CHANNEL = 'file:copy'`, a
     `FileCopyRequest { sourcePath; destinationPath }`, a `FileCopyError` (`'InvalidPath' |
'FileNotFound' | 'FileAlreadyExists' | 'FileWriteFailed'`), and `FileCopyContract`.
   - `src/shared/ipc/ipc-contract/index.ts`: add `FileCopyContract` to the `IpcContract` union.
   - (Contract only — no handler yet; type-checks and builds green on its own.)

4. `[backend]` File copy IPC handler + registration.
   - `src/main/ipc/file/copy-file-handler.ts` (+ `__tests__/copy-file-handler.test.ts`): mirror
     `rename-file-handler.ts` — `runIpc` over `copyFile(...)` provided `FsFileWriterLive` +
     `NodeContext.layer`; `onError` serializes `{ _tag, path }`; `onDefect` → `FileWriteFailed`.
   - `src/main/ipc/register.ts`: register `FILE_COPY_CHANNEL` in `registerFileChannels()`.

5. `[backend]` Folder copy: port method + recursive adapter + tests.
   - `application/folder/port/folder-writer.port.ts`: add
     `copyFolder(source, destination) => Effect<void, FolderNotFound | FolderAlreadyExists | FolderCopyFailed>`.
   - `adapters/folder/fs-folder-writer.ts` (+ adapter test, mirror `fs-folder-writer.rename.test.ts`):
     implement `copyFolder` — source must be an existing directory (else `FolderNotFound`), occupied
     destination → `FolderAlreadyExists`, otherwise **recursive** copy via the platform `FileSystem`
     recursive copy primitive (the recursive walk lives here, not in the use case), any other failure
     → a new `FolderCopyFailed` error.
   - `application/folder/error/folder-copy-failed.ts` (Data.TaggedError `{ path }`).

6. `[backend]` `copyFolder` use case + tests.
   - `application/folder/usecase/copy-folder.ts`: validate both paths via `validateFolderPath`
     (mirror `rename-folder.ts`), delegate to `writer.copyFolder`, return destination. Typed
     `FolderCopyError` alias (`error/folder-copy-error.ts`, mirror `folder-rename-error.ts`).
   - `usecase/__tests__/copy-folder.test.ts`: success; invalid paths → `InvalidFolderPath` without
     touching the writer; each writer error propagates (in-memory `FolderWriter` fake extended with
     `copyFolder`).

7. `[shared]` Folder copy IPC contract.
   - `src/shared/ipc/ipc-contract/folder.ts`: add `FOLDER_COPY_CHANNEL = 'folder:copy'`,
     `FolderCopyRequest`, `FolderCopyError` (`'InvalidFolderPath' | 'FolderNotFound' |
'FolderAlreadyExists' | 'FolderCopyFailed'`), `FolderCopyContract`.
   - `src/shared/ipc/ipc-contract/index.ts`: add to the union.

8. `[backend]` Folder copy IPC handler + registration.
   - `src/main/ipc/folder/copy-folder-handler.ts` (+ test): mirror `rename-folder-handler.ts`.
   - `register.ts`: register `FOLDER_COPY_CHANNEL` in `registerIpc()`.

9. `[frontend]` Renderer ports + IPC adapter + fakes.
   - `explorer/ports/folder-writer.port.ts`: add
     `copyFile(sourcePath, destinationPath) => Promise<Result<string, FileCopyError>>` and
     `copyFolder(...) => Promise<Result<string, FolderCopyError>>`.
   - `explorer/adapters/folder-repository.ipc.ts`: wire both to
     `window.api.invoke(FILE_COPY_CHANNEL, { sourcePath, destinationPath })` /
     `FOLDER_COPY_CHANNEL`.
   - `explorer/__tests__/fake-folder-repository.ts` + `fake-window-api.ts`: extend the fakes so
     existing explorer hook tests still construct a full writer.

10. `[frontend]` Copy/paste command hook + tests.
    - `explorer/useCopyEntry.ts` (+ `__tests__/useCopyEntry.test.tsx`): mirror `useRenameEntry.ts` —
      a `useMutation` whose `mutationFn` branches `file`/`directory` to `writer.copyFile` /
      `copyFolder`, invalidating `folderListingKey(destinationParent)` on `ok: true`. Returns the IPC
      `Result` (`ok: false` is a value the caller branches on).
    - Destination-name derivation: the renderer knows the destination folder's sibling names (the
      `['folder', parent]` listing already cached by `useFolderListings`). The hook (or a small pure
      helper alongside `explorer-tree.ts`) builds the collision-safe destination path from
      `joinPath(parent, deriveCopyName(...))` so paste never relies on the backend to rename. **Blocked
      on Q1.** (If Q2 resolves to backend-derives-name, this helper moves out of the renderer.)

11. `[frontend]` Clipboard state + paste wiring in the explorer tree.
    - `explorer/useExplorerCommands.ts`: add a `copy(args)` that delegates to `useCopyEntry`, mirroring
      `create`/`remove`/`rename`.
    - `explorer/useExplorerTree.ts`: hold the single-entry clipboard (`{ path, type }` in local state),
      expose `copyToClipboard(path)` and `paste(targetFolder)` that resolve the destination parent
      (mirror the `remove`'s `parentPath`/root-scoping), derive the non-colliding name from the cached
      sibling listing, call `copy`, and invalidate. Keep the read/tree vs. write split (CQS): clipboard
      is UI state, the mutation is the command hook. Add focused tests to `useExplorerTree.test.tsx`.

12. `[frontend]` View wiring: row actions + labels + i18n (+ Ctrl+C/Ctrl+V).
    - `explorer-view-types.ts`: add `copyFile`/`copyFolder`/`paste` labels and `onCopy`/`onPaste`
      callbacks to `ExplorerLabels` / `ExplorerCallbacks` / `RowContext`.
    - `ExplorerRows.view.tsx`: add a Copy `IconButton` (lucide `Copy`) to the file & folder
      `RowActions`, and a Paste action (lucide `ClipboardPaste`) on folder rows (and the panel header
      for paste-into-root) shown only when the clipboard is non-empty. `data-testid`s for e2e.
    - `Explorer.controller.tsx` / `Explorer.view.tsx`: thread the new callbacks/labels; resolve strings
      with `t()`.
    - Keyboard: a small `useExplorerKeybindings` (or inline in the controller) mapping Ctrl+C/Ctrl+V to
      copy the selected entry / paste into the selected folder (or the selected file's parent). Respect
      the existing watchWindowShortcuts caveat — only intercept when the explorer owns focus. **See Q3.**
    - i18n: add `explorer.copyFile`, `explorer.copyFolder`, `explorer.paste` to **both** `en.json` and
      `es.json` (parity test).

13. `[e2e]` Manifest ids + real-app spec.
    - `e2e/coverage-manifest.ts`: add `file.copy` and `folder.copy` to `OPERATIONS` (the `explorer`
      feature already exists; copy/paste is part of it).
    - `e2e/explorer-copy-paste.e2e.ts` (mirror `explorer.e2e.ts`): with a temp folder, open it, copy a
      file then paste into a subfolder and assert the copy exists **on disk** with the collision-safe
      name; copy a folder with a nested file and assert the recursive copy lands on disk. Claims
      `operation:file.copy operation:folder.copy` via the `@e2e` header. Manifest ids + spec in the
      **same** commit.

14. `[docs]` Remove this plan file in its own `docs:` commit once all steps ship.

## Constraints

- **Hexagonal / CQS.** Copy is a command. Use cases depend only on ports; the recursive walk and all
  disk I/O live in the adapters; no business logic in IPC handlers, tools, or the renderer beyond
  destination-name derivation from already-cached listings. Reads (listings) stay on the query side.
- **IPC `Result` boundary.** Handlers return a plain `Result`; errors serialize as `{ _tag, path }`;
  nothing throws across IPC. `ok: false` is a value the renderer branches on.
- **Typed errors.** New errors are `Data.TaggedError` with `{ path }`, declared per-kind; the wire
  contract re-declares the `_tag` union (never imports the application error classes).
- **Markdown-only file rule holds.** `copyFile` reuses `validateMarkdownPath`/`ensureMarkdownExtension`
  — a copied file stays `.md`; folder copy reuses `validateFolderPath`.
- **No new dependencies.** Use the platform `FileSystem` copy primitive already available via
  `@effect/platform`; if no suitable recursive-copy method exists, stop and ask rather than adding a
  package.
- **No `as` casts / `@ts-ignore` / `eslint-disable` / non-null `!`.** Fix the code or ask.
- **Frontend:** design tokens only, Base UI, Motion for any new motion, `t()` for every string, **both
  locales**, view/controller split (views call no hooks/IPC), `window.api` only in the adapter,
  `Scrollable` for overflow.
- **Minimal diff.** Touch only the copy path; don't refactor create/rename/delete. Match the existing
  fakes rather than rewriting them.
- **Commit budget.** Each step ≤~300 weighted `src/` lines / ≤15 files; code >30 lines lands a test
  (every backend step pairs a use-case/adapter change with its `__tests__`).

## Open questions

- **Q1 — collision/naming rule (open, BLOCKS steps 1, 10, 11).** When the destination already has an
  entry of that name, what name does the copy get? Proposed default (matches macOS/VS Code feel):
  `name (copy).ext` for the first copy, then `name (copy 2).ext`, `name (copy 3).ext`, …; for folders,
  the suffix goes on the folder name (`my-folder (copy)`). Need confirmation of: exact suffix wording
  (`(copy)` vs `copy` vs `- Copy`), where the number goes, and whether the extension is preserved
  (yes for `.md`). **Do not implement until confirmed.**

- **Q2 — who derives the non-colliding name?** Two valid placements: (a) the **renderer** derives it
  from the already-cached sibling listing and sends a concrete destination path (keeps the backend a
  thin "copy A→B"; matches how rename already sends a concrete `newPath`); or (b) the **backend** use
  case derives it (single source of truth, but the use case then needs the `FolderReader` port to list
  siblings). The plan above assumes **(a)** to mirror rename. Confirm before step 10/11.

- **Q3 — invocation surface: keyboard, context menu, or row buttons?** The explorer today has **no
  context-menu infrastructure** — rows expose hover `IconButton`s only. Options: (i) Ctrl+C/Ctrl+V
  keyboard only; (ii) add Copy/Paste row-action `IconButton`s (matches the existing pattern, no new
  infra); (iii) a real right-click context menu (new Base UI Menu wiring, larger). The plan defaults to
  **(i)+(ii)** (keyboard + row buttons). Confirm scope — a full context menu would be its own step(s).

- **Q4 — paste target resolution.** When pasting with a **file** selected (not a folder), does the
  copy land in that file's **parent folder**, or is paste only enabled when a **folder** is selected /
  the panel header is used? Proposed default: paste targets the selected folder, else the selected
  file's parent, else the workspace root. Confirm.

- **Q5 — copying onto itself / overwrite.** Copy-then-paste into the **same** folder always renames
  (Q1), so no overwrite path exists. Confirm we never overwrite an existing entry (the adapter returns
  `FileAlreadyExists`/`FolderAlreadyExists` if a concrete colliding destination ever reaches it, and the
  renderer-derived name avoids that) — i.e. there is no "replace existing?" prompt in scope.

## Done

- A writer can select a file or folder in the explorer, copy it (Ctrl+C and/or a row Copy button), and
  paste it (Ctrl+V and/or a Paste action) into a target folder; the copy appears in the tree and **on
  disk**, folders copy with all descendants, and a name collision yields the agreed non-colliding name
  instead of failing or overwriting.
- `npm run lint`, `npm run test` (incl. the e2e coverage audit), `npm run type-coverage`, and
  `npm run build` are green; `npm run test:e2e` green for the new `explorer-copy-paste.e2e.ts`.
- Both `en.json` and `es.json` carry the new `explorer.*` keys (parity test green).
