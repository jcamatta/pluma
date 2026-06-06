// The union of every typed failure that picking a folder can produce. Each member carries a
// discriminating _tag so the IPC boundary can serialize it and the frontend can translate it.

import type { FolderSelectionCancelled } from './folder-selection-cancelled'
import type { FolderSelectionFailed } from './folder-selection-failed'

export type FolderSelectionError = FolderSelectionCancelled | FolderSelectionFailed
