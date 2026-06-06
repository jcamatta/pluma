// IPC endpoint for picking a folder from disk. Runs the pickFolder use case with the live Electron
// picker adapter, then serializes the Effect outcome into a plain Result. Never throws across IPC. The
// chosen absolute path comes back on success; cancellation and dialog failure come back as tagged
// errors the renderer translates.

import * as Cause from 'effect/Cause'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import type { FolderSelectionError } from '../../application/folder/error/folder-selection-error'
import { pickFolder } from '../../application/folder/usecase/pick-folder'
import { ElectronFolderPickerLive } from '../../adapters/folder/electron-folder-picker'
import type { Result } from '../result'

type SerializedError = { readonly _tag: FolderSelectionError['_tag'] }

export const handlePickFolder = (): Promise<Result<string, SerializedError>> => {
  const program = pickFolder().pipe(Effect.provide(ElectronFolderPickerLive))

  return Effect.runPromiseExit(program).then(
    (exit): Result<string, SerializedError> =>
      Exit.match(exit, {
        onSuccess: (value) => ({ ok: true, value }),
        onFailure: (cause) => {
          const error = Cause.failureOption(cause)
          return error._tag === 'Some'
            ? { ok: false, error: { _tag: error.value._tag } }
            : { ok: false, error: { _tag: 'FolderSelectionFailed' } }
        }
      })
  )
}
