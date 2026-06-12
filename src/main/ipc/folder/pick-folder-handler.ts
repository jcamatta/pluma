// IPC endpoint for picking a folder from disk. Runs the pickFolder use case with the live Electron
// picker adapter through the shared runIpc wrapper, which logs the call and serializes the Effect outcome
// into a plain Result. Never throws across IPC. The chosen absolute path comes back on success;
// cancellation and dialog failure come back as tagged errors the renderer translates.

import * as Effect from 'effect/Effect'
import { FOLDER_PICK_CHANNEL } from '../../../shared/ipc/ipc-contract/folder'
import type { FolderPickError } from '../../../shared/ipc/ipc-contract/folder'
import type { Result } from '../../../shared/ipc/ipc-result'
import { pickFolder } from '../../application/folder/usecase/pick-folder'
import { ElectronFolderPickerLive } from '../../adapters/folder/electron-folder-picker'
import { runIpc } from '../shared/run-ipc'

export const handlePickFolder = (): Promise<Result<string, FolderPickError>> =>
  runIpc({
    channel: FOLDER_PICK_CHANNEL,
    effect: pickFolder().pipe(Effect.provide(ElectronFolderPickerLive)),
    onError: (error) => ({ _tag: error._tag }),
    onDefect: () => ({ _tag: 'FolderSelectionFailed' })
  })
