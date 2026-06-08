// The union of every typed failure that reading a markdown file's content can produce. Each member
// carries a discriminating _tag so the IPC boundary can serialize it and the frontend can translate it.

import type { InvalidPath } from './invalid-path'
import type { FileNotFound } from './file-not-found'
import type { FileReadFailed } from './file-read-failed'

export type FileReadingError = InvalidPath | FileNotFound | FileReadFailed
