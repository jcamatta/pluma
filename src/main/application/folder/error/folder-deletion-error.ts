// The union of every typed failure that deleting a folder can produce. Each member carries a
// discriminating _tag so the IPC boundary can serialize it and the frontend can translate it.

import type { InvalidFolderPath } from './invalid-folder-path'
import type { FolderNotFound } from './folder-not-found'
import type { FolderDeleteFailed } from './folder-delete-failed'

export type FolderDeletionError = InvalidFolderPath | FolderNotFound | FolderDeleteFailed
