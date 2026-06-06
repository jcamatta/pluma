// IPC endpoint for listing a folder's immediate children. Runs the listFolder use case with the live
// filesystem adapter, then serializes the Effect outcome into a plain Result. Never throws across IPC.

import * as NodeContext from '@effect/platform-node/NodeContext'
import * as Cause from 'effect/Cause'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import type { FolderEntry } from '../../application/folder/data/entry'
import type { FolderListingError } from '../../application/folder/error/folder-listing-error'
import { listFolder } from '../../application/folder/usecase/list-folder'
import { FsFolderReaderLive } from '../../adapters/folder/fs-folder-reader'
import type { Result } from '../result'

type SerializedError = { readonly _tag: FolderListingError['_tag']; readonly path: string }

export const handleListFolder = (
  path: string
): Promise<Result<ReadonlyArray<FolderEntry>, SerializedError>> => {
  const program = listFolder(path).pipe(
    Effect.provide(FsFolderReaderLive),
    Effect.provide(NodeContext.layer)
  )

  return Effect.runPromiseExit(program).then(
    (exit): Result<ReadonlyArray<FolderEntry>, SerializedError> =>
      Exit.match(exit, {
        onSuccess: (value) => ({ ok: true, value }),
        onFailure: (cause) => {
          const error = Cause.failureOption(cause)
          return error._tag === 'Some'
            ? { ok: false, error: { _tag: error.value._tag, path: error.value.path } }
            : { ok: false, error: { _tag: 'FolderReadFailed', path } }
        }
      })
  )
}
