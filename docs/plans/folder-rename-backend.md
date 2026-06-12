# Rename a folder — backend (`folder:rename`)

Backend half of the folder-rename feature, shipped as its **own PR**. It adds the full main-process
vertical slice for a `folder:rename` IPC channel — shared wire contract, application use case, typed
errors, the `FolderWriter` port method, the filesystem adapter, and the IPC endpoint + registration —
mirroring the existing folder create/delete slice and the agent-thread rename (`agent:rename-thread`).

The renderer (port/adapter, command hook, inline-rename UI) and the e2e spec ship in a **separate
frontend PR / plan**. This PR exposes and registers the channel but no user can trigger it yet, so it
deliberately **does not** touch `e2e/coverage-manifest.ts` (per the rule: don't list an operation
until a real-app spec exercises it — that lands with the frontend UI).

## Done

- A `folder:rename` IPC channel exists end to end on the main side: `handleRenameFolder({ oldPath,
newPath })` runs the `renameFolder` use case through the live filesystem adapter and returns a plain
  `Result<string, FolderRenameError>`.
- The use case validates both paths and the adapter performs the move, mapping filesystem state to
  typed errors: existing target → `FolderAlreadyExists`, missing/non-directory source →
  `FolderNotFound`, any other failure → `FolderRenameFailed`, invalid path → `InvalidFolderPath`.
- `npm run lint`, `npm run test`, `npm run type-coverage`, and `npm run build` are green. (No
  `test:e2e` — there is no UI in this PR.) Every commit clears the `veto` gate.

## Steps

Each step is one mini-commit, ordered to land green on what came before. Everything here is under
`src/`, so it carries commit-size weight — steps are kept small and land with their tests.

### 1. Shared IPC contract — `folder:rename`

- **`src/shared/ipc/ipc-contract/folder.ts`** — add `FOLDER_RENAME_CHANNEL = 'folder:rename'`, a
  `FolderRenameRequest { readonly oldPath: string; readonly newPath: string }` (request-object input,
  like `RenameThreadRequest`), a `FolderRenameError` (`_tag: 'InvalidFolderPath' | 'FolderNotFound' |
'FolderAlreadyExists' | 'FolderRenameFailed'`, `path: string`), and a `FolderRenameContract`
  (`IpcContractDefinition<typeof FOLDER_RENAME_CHANNEL, FolderRenameRequest, string, FolderRenameError>`);
  export all four.
- **`src/shared/ipc/ipc-contract/index.ts`** — add `FolderRenameContract` to the `IpcContract` union.

Type-only. If this commit exceeds 30 weighted lines (it may), it has no natural unit test; merge it
into step 2 so the use-case test covers the commit, rather than inventing a contract test.

### 2. Application — error union, port method, use case (+ tests)

- **`src/main/application/folder/error/folder-rename-failed.ts`** _(new)_ — `Data.TaggedError`
  `FolderRenameFailed { readonly path: string }`, mirroring `folder-delete-failed.ts`.
- **`src/main/application/folder/error/folder-rename-error.ts`** _(new)_ — union
  `InvalidFolderPath | FolderNotFound | FolderAlreadyExists | FolderRenameFailed` (the first three
  already exist).
- **`src/main/application/folder/port/folder-writer.port.ts`** _(edit)_ — add
  `renameFolder: (oldPath: string, newPath: string) => Effect<void, FolderNotFound | FolderAlreadyExists | FolderRenameFailed>`.
- **`src/main/application/folder/usecase/rename-folder.ts`** _(new)_ — `validateFolderPath(oldPath)`
  then `validateFolderPath(newPath)`, then `writer.renameFolder(validOld, validNew)`, returning
  `validNew`. Same shape as `delete-folder.ts`.
- **`src/main/application/folder/usecase/__tests__/rename-folder.test.ts`** _(new)_ — in-memory fake
  `FolderWriter` (the delete-folder test is the template): success returns the validated new path and
  calls the writer with both validated paths; invalid old path and invalid new path each fail with
  `InvalidFolderPath` without touching the writer; `FolderNotFound` / `FolderAlreadyExists` /
  `FolderRenameFailed` propagate.

> Note: the fake `FolderWriter` in this and the delete-folder test must gain the new `renameFolder`
> member to keep satisfying the port — a tiny edit to the existing test's inline fakes.

### 3. Adapter — `fs-folder-writer.renameFolder` (+ tests)

- **`src/main/adapters/folder/fs-folder-writer.ts`** _(edit)_ — implement `renameFolder(old, next)`:
  `stat(old)` not a `Directory` ⇒ `FolderNotFound`; `exists(next)` ⇒ `FolderAlreadyExists`; else
  `fs.rename(old, next)` mapping any failure to `FolderRenameFailed`. Add it to
  `FolderWriter.of({...})`.
- **`src/main/adapters/folder/__tests__/fs-folder-writer.rename.test.ts`** _(new)_ — against a real
  temp dir (mirror `fs-folder-writer.delete.test.ts`): renames a populated folder and its contents move
  with it; `FolderNotFound` when the source is missing or is a regular file; `FolderAlreadyExists` when
  the target already exists (and the source is left untouched).

### 4. IPC endpoint + registration (+ handler test)

- **`src/main/ipc/folder/rename-folder-handler.ts`** _(new)_ —
  `handleRenameFolder({ oldPath, newPath }: FolderRenameRequest): Promise<Result<string, FolderRenameError>>`
  via `runIpc`, providing `FsFolderWriterLive` + `NodeContext.layer`, `onError` passing
  `{ _tag, path }`, `onDefect` → `{ _tag: 'FolderRenameFailed', path: newPath }`. Mirrors
  `delete-folder-handler.ts`.
- **`src/main/ipc/register.ts`** _(edit)_ — import `FOLDER_RENAME_CHANNEL` + `FolderRenameRequest` +
  `handleRenameFolder`; register
  `ipcMain.handle(FOLDER_RENAME_CHANNEL, (_e, req: FolderRenameRequest) => handleRenameFolder(req))`
  in `registerIpc`.
- **`src/main/ipc/folder/__tests__/rename-folder-handler.test.ts`** _(new)_ — real temp dir (mirror
  `delete-folder-handler.test.ts`): `ok: true` with the new path on success (and the folder moved);
  `ok: false` with `InvalidFolderPath` for a blank name; `FolderNotFound` for a missing source;
  `FolderAlreadyExists` for an existing target.
- **`src/main/ipc/__tests__/register.test.ts`** _(edit, only if it asserts the registered channel
  set)_ — add `FOLDER_RENAME_CHANNEL`.

### 5. Remove this plan (separate `docs:` commit)

When steps 1–4 are green, delete `docs/plans/folder-rename-backend.md` in its own `docs:` commit, then
`finish-plan` opens the backend PR.

## Constraints

- **Layering / CQS.** IPC → application; adapter wired at the edge. Rename is a **command** on the
  writer port; it returns the new path (an ack), never reads.
- **`Result` boundary.** Effect stays inside; the handler serializes success/each tagged error into
  `Result`, never throws across IPC.
- **No new dependencies.** Reuses Effect, `@effect/platform` `FileSystem`/`Path`, and existing folder
  errors/validation.
- **Scope-agnostic backend.** The use case/adapter accept any valid `oldPath`/`newPath` pair; whether
  the UI restricts rename to the last path segment is a frontend concern decided in the frontend plan.
- **Manifest untouched.** No `e2e/coverage-manifest.ts` edit in this PR; the `folder.rename` operation
  id + real-app spec land with the frontend UI that makes the channel user-triggerable.

## Open questions

- None blocking the backend. (Behavioral choices — collision/missing handling — are settled above and
  match the create/delete adapter.)

## Effort

**Easy / low-risk.** Every step is a near-exact mirror of the existing folder delete slice; the only
new logic is the adapter's two-guard `fs.rename`. ~4–5 mini-commits.
