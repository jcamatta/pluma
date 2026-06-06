// The union of every typed failure that creating a markdown file can produce. Each member carries a
// discriminating _tag so the IPC boundary can serialize it and the frontend can translate it.

import type { InvalidPath } from './invalid-path'
import type { FileAlreadyExists } from './file-already-exists'
import type { DirectoryNotFound } from './directory-not-found'
import type { FileWriteFailed } from './file-write-failed'

export type FileCreationError =
  | InvalidPath
  | FileAlreadyExists
  | DirectoryNotFound
  | FileWriteFailed
