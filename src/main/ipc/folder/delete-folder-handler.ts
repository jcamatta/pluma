// IPC endpoint for deleting a folder. Runs the deleteFolder use case with the live filesystem
// adapter, then serializes the Effect outcome into a plain Result. Never throws across IPC.

import * as NodeContext from '@effect/platform-node/NodeContext'
import * as Cause from 'effect/Cause'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import type { FolderDeleteError } from '../../../shared/ipc/ipc-contract/folder'
import type { Result } from '../../../shared/ipc/ipc-result'
import { deleteFolder } from '../../application/folder/usecase/delete-folder'
import { FsFolderWriterLive } from '../../adapters/folder/fs-folder-writer'

export const handleDeleteFolder = (path: string): Promise<Result<string, FolderDeleteError>> => {
  const program = deleteFolder(path).pipe(
    Effect.provide(FsFolderWriterLive),
    Effect.provide(NodeContext.layer)
  )

  return Effect.runPromiseExit(program).then(
    (exit): Result<string, FolderDeleteError> =>
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
