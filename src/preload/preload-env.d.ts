// Ambient global types for the preload bridge. This file has no top-level import/export, so its
// `declare global` is a true global augmentation visible to every file in the program (including
// index.ts, which assigns these onto window in the non-isolated fallback). Imported types are
// referenced through inline `import('...')` so the file stays script-global rather than a module.

type Result<T, E extends { _tag: string }> = { ok: true; value: T } | { ok: false; error: E }

type CreateFileError = {
  _tag: 'InvalidPath' | 'FileAlreadyExists' | 'DirectoryNotFound' | 'FileWriteFailed'
  path: string
}

type DeleteFileError = {
  _tag: 'InvalidPath' | 'FileNotFound' | 'FileDeleteFailed'
  path: string
}

type WriteFileError = {
  _tag: 'InvalidPath' | 'FileNotFound' | 'FileWriteFailed'
  path: string
}

type CreateFolderError = {
  _tag:
    | 'InvalidFolderPath'
    | 'FolderAlreadyExists'
    | 'ParentDirectoryNotFound'
    | 'FolderCreationFailed'
  path: string
}

type DeleteFolderError = {
  _tag: 'InvalidFolderPath' | 'FolderNotFound' | 'FolderDeleteFailed'
  path: string
}

type ListFolderError = {
  _tag: 'InvalidFolderPath' | 'FolderNotFound' | 'FolderReadFailed'
  path: string
}

type WatchFolderError = {
  _tag: 'FolderWatchFailed'
  path: string
}

type PickFolderError = {
  _tag: 'FolderSelectionCancelled' | 'FolderSelectionFailed'
}

type FolderEntry = {
  name: string
  type: 'file' | 'directory'
}

type FolderChange = {
  type: 'created' | 'updated' | 'deleted'
  path: string
}

type RunAgentError = {
  _tag: 'RunAgentFailed'
}

interface Api {
  createFile: (path: string) => Promise<Result<string, CreateFileError>>
  deleteFile: (path: string) => Promise<Result<string, DeleteFileError>>
  writeFile: (path: string, content: string) => Promise<Result<string, WriteFileError>>
  createFolder: (path: string) => Promise<Result<string, CreateFolderError>>
  deleteFolder: (path: string) => Promise<Result<string, DeleteFolderError>>
  listFolder: (path: string) => Promise<Result<ReadonlyArray<FolderEntry>, ListFolderError>>
  pickFolder: () => Promise<Result<string, PickFolderError>>
  watchFolder: (path: string) => Promise<Result<null, WatchFolderError>>
  onFolderChanged: (listener: (event: FolderChange) => void) => () => void
  runAgent: (
    input: import('../main/application/agent/data/run-agent-input').RunAgentInput
  ) => Promise<Result<{ runId: string }, RunAgentError>>
  abortAgent: (runId: string) => Promise<Result<null, never>>
  onAgentEvent: (listener: (event: import('@ag-ui/core').BaseEvent) => void) => () => void
}

interface Window {
  electron: import('@electron-toolkit/preload').ElectronAPI
  api: Api
}
