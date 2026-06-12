// The union of every typed failure that renaming a folder can produce. Each member carries a
// discriminating _tag so the IPC boundary can serialize it and the frontend can translate it.

import type { InvalidFolderPath } from './invalid-folder-path'
import type { FolderNotFound } from './folder-not-found'
import type { FolderAlreadyExists } from './folder-already-exists'
import type { FolderRenameFailed } from './folder-rename-failed'

export type FolderRenameError =
  | InvalidFolderPath
  | FolderNotFound
  | FolderAlreadyExists
  | FolderRenameFailed
