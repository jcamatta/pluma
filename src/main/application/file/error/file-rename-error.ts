// The union of every typed failure that renaming a file can produce. Each member carries a
// discriminating _tag so the IPC boundary can serialize it and the frontend can translate it.

import type { InvalidPath } from './invalid-path'
import type { FileNotFound } from './file-not-found'
import type { FileAlreadyExists } from './file-already-exists'
import type { FileRenameFailed } from './file-rename-failed'

export type FileRenameError = InvalidPath | FileNotFound | FileAlreadyExists | FileRenameFailed
