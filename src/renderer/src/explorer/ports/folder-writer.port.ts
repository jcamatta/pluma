// The explorer's command port: mutations over the workspace (create/delete file or folder) plus the OS
// watch. Split from the reader per CQS so the write path is a distinct contract. Each mutation returns
// the IPC Result unchanged. watch starts the OS watcher; onChange subscribes to the folder:changed
// stream and returns an unsubscribe function.

import type { Result } from '../../../../shared/ipc/ipc-result'
import type { FolderChange } from '../../../../shared/ipc/ipc-event-contract/folder'
import type {
  FolderCreateError,
  FolderDeleteError,
  FolderWatchError
} from '../../../../shared/ipc/ipc-contract/folder'
import type { FileCreateError, FileDeleteError } from '../../../../shared/ipc/ipc-contract/file'

interface FolderWriterPort {
  readonly createFile: (path: string) => Promise<Result<string, FileCreateError>>
  readonly createFolder: (path: string) => Promise<Result<string, FolderCreateError>>
  readonly deleteFile: (path: string) => Promise<Result<string, FileDeleteError>>
  readonly deleteFolder: (path: string) => Promise<Result<string, FolderDeleteError>>
  readonly watch: (path: string) => Promise<Result<null, FolderWatchError>>
  readonly onChange: (callback: (change: FolderChange) => void) => () => void
}

export type { FolderWriterPort }
