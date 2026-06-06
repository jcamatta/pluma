import { ElectronAPI } from '@electron-toolkit/preload'
import type { BaseEvent } from '@ag-ui/core'
import type { RunAgentInput } from '../main/application/agent/data/run-agent-input'

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
  runAgent: (input: RunAgentInput) => Promise<Result<{ runId: string }, RunAgentError>>
  abortAgent: (runId: string) => Promise<Result<null, never>>
  onAgentEvent: (listener: (event: BaseEvent) => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
  }
}
