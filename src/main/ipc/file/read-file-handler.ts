// IPC endpoint for reading the content of a markdown file. Runs the readFile use case with the live
// filesystem adapter through the shared runIpc wrapper, which logs the call and serializes the Effect
// outcome into a plain Result. Never throws across IPC.

import * as NodeContext from '@effect/platform-node/NodeContext'
import * as Effect from 'effect/Effect'
import { FILE_READ_CHANNEL } from '../../../shared/ipc/ipc-contract/file'
import type { FileReadError } from '../../../shared/ipc/ipc-contract/file'
import type { Result } from '../../../shared/ipc/ipc-result'
import { readFile } from '../../application/file/usecase/read-file'
import { FsFileReaderLive } from '../../adapters/file/fs-file-reader'
import { runIpc } from '../shared/run-ipc'

export const handleReadFile = (path: string): Promise<Result<string, FileReadError>> =>
  runIpc({
    channel: FILE_READ_CHANNEL,
    annotations: { path },
    effect: readFile(path).pipe(
      Effect.provide(FsFileReaderLive),
      Effect.provide(NodeContext.layer)
    ),
    onError: (error) => ({ _tag: error._tag, path: error.path }),
    onDefect: () => ({ _tag: 'FileReadFailed', path })
  })
