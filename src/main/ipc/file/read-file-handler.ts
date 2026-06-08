// IPC endpoint for reading the content of a markdown file. Runs the readFile use case with the live
// filesystem adapter, then serializes the Effect outcome into a plain Result. Never throws across IPC.

import * as NodeContext from '@effect/platform-node/NodeContext'
import * as Cause from 'effect/Cause'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import type { FileReadError } from '../../../shared/ipc/ipc-contract/file'
import type { Result } from '../../../shared/ipc/ipc-result'
import { readFile } from '../../application/file/usecase/read-file'
import { FsFileReaderLive } from '../../adapters/file/fs-file-reader'

export const handleReadFile = (path: string): Promise<Result<string, FileReadError>> => {
  const program = readFile(path).pipe(
    Effect.provide(FsFileReaderLive),
    Effect.provide(NodeContext.layer)
  )

  return Effect.runPromiseExit(program).then(
    (exit): Result<string, FileReadError> =>
      Exit.match(exit, {
        onSuccess: (value) => ({ ok: true, value }),
        onFailure: (cause) => {
          const error = Cause.failureOption(cause)
          return error._tag === 'Some'
            ? { ok: false, error: { _tag: error.value._tag, path: error.value.path } }
            : { ok: false, error: { _tag: 'FileReadFailed', path } }
        }
      })
  )
}
