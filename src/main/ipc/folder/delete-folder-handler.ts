// IPC endpoint for deleting a folder. Runs the deleteFolder use case with the live filesystem
// adapter, then serializes the Effect outcome into a plain Result. Never throws across IPC.

import * as NodeContext from '@effect/platform-node/NodeContext'
import * as Cause from 'effect/Cause'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import type { FolderDeletionError } from '../../application/folder/error/folder-deletion-error'
import { deleteFolder } from '../../application/folder/usecase/delete-folder'
import { FsFolderWriterLive } from '../../adapters/folder/fs-folder-writer'
import type { Result } from '../result'

type SerializedError = { readonly _tag: FolderDeletionError['_tag']; readonly path: string }

export const handleDeleteFolder = (path: string): Promise<Result<string, SerializedError>> => {
  const program = deleteFolder(path).pipe(
    Effect.provide(FsFolderWriterLive),
    Effect.provide(NodeContext.layer)
  )

  return Effect.runPromiseExit(program).then(
    (exit): Result<string, SerializedError> =>
      Exit.match(exit, {
        onSuccess: (value) => ({ ok: true, value }),
        onFailure: (cause) => {
          const error = Cause.failureOption(cause)
          return error._tag === 'Some'
            ? { ok: false, error: { _tag: error.value._tag, path: error.value.path } }
            : { ok: false, error: { _tag: 'FolderDeleteFailed', path } }
        }
      })
  )
}
