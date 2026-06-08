// The explorer's query port: reads folder listings. Split from the writer per CQS so the read path is a
// distinct contract. Returns the IPC Result unchanged; ok: false is a value the UI branches on, never a
// thrown error.

import type { Result } from '../../../../shared/ipc/ipc-result'
import type { FolderEntry, FolderListError } from '../../../../shared/ipc/ipc-contract/folder'

interface FolderReaderPort {
  readonly list: (path: string) => Promise<Result<readonly FolderEntry[], FolderListError>>
}

export type { FolderReaderPort }
