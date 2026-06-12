// IPC endpoint for creating a markdown file. Runs the createFile use case with the live filesystem
// adapter through the shared runIpc wrapper, which logs the call and serializes the Effect outcome into
// a plain Result. Never throws across IPC.

import * as NodeContext from '@effect/platform-node/NodeContext'
import * as Effect from 'effect/Effect'
import { FILE_CREATE_CHANNEL } from '../../../shared/ipc/ipc-contract/file'
import type { FileCreateError } from '../../../shared/ipc/ipc-contract/file'
import type { Result } from '../../../shared/ipc/ipc-result'
import { createFile } from '../../application/file/usecase/create-file'
import { FsFileWriterLive } from '../../adapters/file/fs-file-writer'
import { runIpc } from '../shared/run-ipc'

export const handleCreateFile = (path: string): Promise<Result<string, FileCreateError>> =>
  runIpc({
    channel: FILE_CREATE_CHANNEL,
    annotations: { path },
    effect: createFile(path).pipe(
      Effect.provide(FsFileWriterLive),
      Effect.provide(NodeContext.layer)
    ),
    onError: (error) => ({ _tag: error._tag, path: error.path }),
    onDefect: () => ({ _tag: 'FileWriteFailed', path })
  })
