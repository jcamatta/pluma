// IPC endpoint for renaming a file. Runs the renameFile use case with the live filesystem adapter
// through the shared runIpc wrapper, which logs the call and serializes the Effect outcome into a plain
// Result. Never throws across IPC.

import * as NodeContext from '@effect/platform-node/NodeContext'
import * as Effect from 'effect/Effect'
import { FILE_RENAME_CHANNEL } from '../../../shared/ipc/ipc-contract/file'
import type { FileRenameError, FileRenameRequest } from '../../../shared/ipc/ipc-contract/file'
import type { Result } from '../../../shared/ipc/ipc-result'
import { renameFile } from '../../application/file/usecase/rename-file'
import { FsFileWriterLive } from '../../adapters/file/fs-file-writer'
import { runIpc } from '../shared/run-ipc'

export const handleRenameFile = ({
  oldPath,
  newPath
}: FileRenameRequest): Promise<Result<string, FileRenameError>> =>
  runIpc({
    channel: FILE_RENAME_CHANNEL,
    annotations: { oldPath, newPath },
    effect: renameFile(oldPath, newPath).pipe(
      Effect.provide(FsFileWriterLive),
      Effect.provide(NodeContext.layer)
    ),
    onError: (error) => ({ _tag: error._tag, path: error.path }),
    onDefect: () => ({ _tag: 'FileRenameFailed', path: newPath })
  })
