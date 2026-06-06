// Use case: ask the user to pick a folder from disk. Delegates to the FolderPicker port to show the
// native folder dialog and returns the chosen absolute path on success, or a typed FolderSelectionError
// when the user cancels or the dialog fails. Picking a folder is its own step; opening a workspace is a
// higher-level flow that may use the chosen path along with further options.

import * as Effect from 'effect/Effect'
import type { FolderSelectionError } from '../error/folder-selection-error'
import { FolderPicker } from '../port/folder-picker.port'
import type { FolderPickerPort } from '../port/folder-picker.port'

export const pickFolder = (): Effect.Effect<string, FolderSelectionError, FolderPickerPort> =>
  Effect.gen(function* () {
    const picker = yield* FolderPicker
    return yield* picker.pickFolder()
  })
