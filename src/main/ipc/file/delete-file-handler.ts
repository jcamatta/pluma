// IPC endpoint for deleting a markdown file. Runs the deleteFile use case with the live filesystem
// adapter through the shared runIpc wrapper, which logs the call and serializes the Effect outcome into
// a plain Result. Never throws across IPC.

import * as NodeContext from '@effect/platform-node/NodeContext'
import * as Effect from 'effect/Effect'
import { FILE_DELETE_CHANNEL } from '../../../shared/ipc/ipc-contract/file'
import type { FileDeleteError } from '../../../shared/ipc/ipc-contract/file'
import type { Result } from '../../../shared/ipc/ipc-result'
import { deleteFile } from '../../application/file/usecase/delete-file'
import { FsFileWriterLive } from '../../adapters/file/fs-file-writer'
import { runIpc } from '../shared/run-ipc'

export const handleDeleteFile = (path: string): Promise<Result<string, FileDeleteError>> =>
  runIpc({
    channel: FILE_DELETE_CHANNEL,
    annotations: { path },
    effect: deleteFile(path).pipe(
      Effect.provide(FsFileWriterLive),
      Effect.provide(NodeContext.layer)
    ),
    onError: (error) => ({ _tag: error._tag, path: error.path }),
    onDefect: () => ({ _tag: 'FileDeleteFailed', path })
  })
