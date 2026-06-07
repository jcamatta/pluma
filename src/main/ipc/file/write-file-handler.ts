// IPC endpoint for writing content to a markdown file. Runs the writeFile use case with the live
// filesystem adapter, then serializes the Effect outcome into a plain Result. Never throws across IPC.

import * as NodeContext from '@effect/platform-node/NodeContext'
import * as Cause from 'effect/Cause'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import type { FileWriteError } from '../../../shared/ipc/ipc-contract/file'
import type { Result } from '../../../shared/ipc/ipc-result'
import { writeFile } from '../../application/file/usecase/write-file'
import { FsFileWriterLive } from '../../adapters/file/fs-file-writer'

export const handleWriteFile = (
  path: string,
  content: string
): Promise<Result<string, FileWriteError>> => {
  const program = writeFile(path, content).pipe(
    Effect.provide(FsFileWriterLive),
    Effect.provide(NodeContext.layer)
  )

  return Effect.runPromiseExit(program).then(
    (exit): Result<string, FileWriteError> =>
      Exit.match(exit, {
        onSuccess: (value) => ({ ok: true, value }),
        onFailure: (cause) => {
          const error = Cause.failureOption(cause)
          return error._tag === 'Some'
            ? { ok: false, error: { _tag: error.value._tag, path: error.value.path } }
            : { ok: false, error: { _tag: 'FileWriteFailed', path } }
        }
      })
  )
}
