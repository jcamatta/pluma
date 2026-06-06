// FolderPicker adapter backed by Electron's native dialog. The only place that touches
// dialog.showOpenDialog. Opens a directory-only picker; maps its outcome to the domain's typed
// results: a chosen folder -> its absolute path, a dismissed dialog -> FolderSelectionCancelled,
// any thrown error -> FolderSelectionFailed.

import { dialog } from 'electron'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import { FolderSelectionCancelled } from '../../application/folder/error/folder-selection-cancelled'
import { FolderSelectionFailed } from '../../application/folder/error/folder-selection-failed'
import { FolderPicker } from '../../application/folder/port/folder-picker.port'

const pickFolder = (): Effect.Effect<string, FolderSelectionCancelled | FolderSelectionFailed> =>
  Effect.tryPromise({
    try: () =>
      dialog.showOpenDialog({
        title: 'Select Folder',
        properties: ['openDirectory', 'createDirectory']
      }),
    catch: () => new FolderSelectionFailed({})
  }).pipe(
    Effect.flatMap((result) => {
      const [path] = result.filePaths
      if (result.canceled || path === undefined) {
        return new FolderSelectionCancelled({})
      }
      return Effect.succeed(path)
    })
  )

export const ElectronFolderPickerLive = Layer.succeed(FolderPicker, FolderPicker.of({ pickFolder }))
