// The union of every typed failure that creating a folder can produce. Each member carries a
// discriminating _tag so the IPC boundary can serialize it and the frontend can translate it.

import type { InvalidFolderPath } from './invalid-folder-path'
import type { FolderAlreadyExists } from './folder-already-exists'
import type { ParentDirectoryNotFound } from './parent-directory-not-found'
import type { FolderCreationFailed } from './folder-creation-failed'

export type FolderCreationError =
  | InvalidFolderPath
  | FolderAlreadyExists
  | ParentDirectoryNotFound
  | FolderCreationFailed
