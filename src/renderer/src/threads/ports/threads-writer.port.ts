// The threads feature's command port: renames and deletes threads. Split from the reader per CQS. The
// rename arguments are bundled into one record so the method stays within the two-parameter limit. Each
// mutation returns the IPC Result unchanged; ok: false is a value the caller branches on, never thrown.

import type { Result } from '../../../../shared/ipc/ipc-result'
import type { ThreadWriteError } from '../../../../shared/ipc/ipc-contract/agent'

interface RenameThreadArgs {
  readonly cwd: string
  readonly id: string
  readonly title: string
}

interface ThreadsWriterPort {
  readonly renameThread: (args: RenameThreadArgs) => Promise<Result<null, ThreadWriteError>>
  readonly deleteThread: (cwd: string, id: string) => Promise<Result<null, ThreadWriteError>>
}

export type { ThreadsWriterPort, RenameThreadArgs }
