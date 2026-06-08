// The explorer's file read port: reads a single file's content. A query port, kept apart from the
// folder reader/writer per CQS. Returns the IPC Result unchanged; ok: false is a value the UI branches
// on, never a thrown error.

import type { Result } from '../../../../shared/ipc/ipc-result'
import type { FileReadError } from '../../../../shared/ipc/ipc-contract/file'

interface FileReaderPort {
  readonly read: (path: string) => Promise<Result<string, FileReadError>>
}

export type { FileReaderPort }
