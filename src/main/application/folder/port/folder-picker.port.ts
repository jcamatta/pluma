// Port for asking the user to pick a folder from disk. The use case depends on this interface, never
// on Electron's dialog. The adapter (in adapters/) implements it with the native open dialog; tests
// provide a fake. Cancellation and dialog failure surface as typed errors. Kept separate from
// FolderReader/FolderWriter because it interacts with the user, not the filesystem.

import * as Context from 'effect/Context'
import type * as Effect from 'effect/Effect'
import type { FolderSelectionCancelled } from '../error/folder-selection-cancelled'
import type { FolderSelectionFailed } from '../error/folder-selection-failed'

export interface FolderPickerPort {
  readonly pickFolder: () => Effect.Effect<string, FolderSelectionCancelled | FolderSelectionFailed>
}

export const FolderPicker = Context.GenericTag<FolderPickerPort>('application/FolderPicker')
