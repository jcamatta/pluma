// IPC endpoint for writing content to a markdown file. Runs the writeFile use case with the live
// filesystem adapter through the shared runIpc wrapper, which logs the call and serializes the Effect
// outcome into a plain Result. Only the path is annotated — never the file content. Never throws across IPC.

import * as NodeContext from '@effect/platform-node/NodeContext'
import * as Effect from 'effect/Effect'
import { FILE_WRITE_CHANNEL } from '../../../shared/ipc/ipc-contract/file'
import type { FileWriteError } from '../../../shared/ipc/ipc-contract/file'
import type { Result } from '../../../shared/ipc/ipc-result'
import { writeFile } from '../../application/file/usecase/write-file'
import { FsFileWriterLive } from '../../adapters/file/fs-file-writer'
import { runIpc } from '../shared/run-ipc'

export const handleWriteFile = (
  path: string,
  content: string
): Promise<Result<string, FileWriteError>> =>
  runIpc({
    channel: FILE_WRITE_CHANNEL,
    annotations: { path },
    effect: writeFile(path, content).pipe(
      Effect.provide(FsFileWriterLive),
      Effect.provide(NodeContext.layer)
    ),
    onError: (error) => ({ _tag: error._tag, path: error.path }),
    onDefect: () => ({ _tag: 'FileWriteFailed', path })
  })
