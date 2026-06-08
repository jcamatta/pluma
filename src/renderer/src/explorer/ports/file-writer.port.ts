// The explorer's file write port: writes content to a single file. A command port, kept apart from the
// file reader per CQS — the editor's autosave drives it. Returns the IPC Result unchanged; ok: false is
// a value the caller branches on, never a thrown error.

import type { Result } from '../../../../shared/ipc/ipc-result'
import type { FileWriteError } from '../../../../shared/ipc/ipc-contract/file'

interface FileWriterPort {
  readonly write: (path: string, content: string) => Promise<Result<string, FileWriteError>>
}

export type { FileWriterPort }
