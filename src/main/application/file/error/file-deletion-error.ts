// The union of every typed failure that deleting a markdown file can produce. Each member carries a
// discriminating _tag so the IPC boundary can serialize it and the frontend can translate it.

import type { InvalidPath } from './invalid-path'
import type { FileNotFound } from './file-not-found'
import type { FileDeleteFailed } from './file-delete-failed'

export type FileDeletionError = InvalidPath | FileNotFound | FileDeleteFailed
