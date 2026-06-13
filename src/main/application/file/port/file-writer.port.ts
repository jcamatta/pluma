// Port for creating files on disk. The use case depends on this interface, never on a concrete
// filesystem. The adapter (in adapters/) implements it; tests provide an in-memory fake.

import * as Context from 'effect/Context'
import type * as Effect from 'effect/Effect'
import type { FileAlreadyExists } from '../error/file-already-exists'
import type { DirectoryNotFound } from '../error/directory-not-found'
import type { FileWriteFailed } from '../error/file-write-failed'
import type { FileNotFound } from '../error/file-not-found'
import type { FileDeleteFailed } from '../error/file-delete-failed'
import type { FileRenameFailed } from '../error/file-rename-failed'

export interface FileWriterPort {
  readonly createEmptyFile: (
    path: string
  ) => Effect.Effect<void, FileAlreadyExists | DirectoryNotFound | FileWriteFailed>
  readonly deleteFile: (path: string) => Effect.Effect<void, FileNotFound | FileDeleteFailed>
  readonly renameFile: (
    oldPath: string,
    newPath: string
  ) => Effect.Effect<void, FileNotFound | FileAlreadyExists | FileRenameFailed>
  readonly writeFile: (
    path: string,
    content: string
  ) => Effect.Effect<void, FileNotFound | FileWriteFailed>
}

export const FileWriter = Context.GenericTag<FileWriterPort>('application/FileWriter')
