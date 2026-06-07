// IPC endpoint for deleting a markdown file. Runs the deleteFile use case with the live filesystem
// adapter, then serializes the Effect outcome into a plain Result. Never throws across IPC.

import * as NodeContext from '@effect/platform-node/NodeContext'
import * as Cause from 'effect/Cause'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import type { FileDeleteError } from '../../../shared/ipc/ipc-contract/file'
import type { Result } from '../../../shared/ipc/ipc-result'
import { deleteFile } from '../../application/file/usecase/delete-file'
import { FsFileWriterLive } from '../../adapters/file/fs-file-writer'

export const handleDeleteFile = (path: string): Promise<Result<string, FileDeleteError>> => {
  const program = deleteFile(path).pipe(
    Effect.provide(FsFileWriterLive),
    Effect.provide(NodeContext.layer)
  )

  return Effect.runPromiseExit(program).then(
    (exit): Result<string, FileDeleteError> =>
      Exit.match(exit, {
        onSuccess: (value) => ({ ok: true, value }),
        onFailure: (cause) => {
          const error = Cause.failureOption(cause)
          return error._tag === 'Some'
            ? { ok: false, error: { _tag: error.value._tag, path: error.value.path } }
            : { ok: false, error: { _tag: 'FileDeleteFailed', path } }
        }
      })
  )
}
