// Port for reading files on disk. The use case depends on this interface, never on a concrete
// filesystem. The adapter (in adapters/) implements it; tests provide an in-memory fake. Kept
// separate from FileWriter so reads and mutations stay segregated.

import * as Context from 'effect/Context'
import type * as Effect from 'effect/Effect'
import type { FileNotFound } from '../error/file-not-found'
import type { FileReadFailed } from '../error/file-read-failed'

export interface FileReaderPort {
  readonly readFile: (path: string) => Effect.Effect<string, FileNotFound | FileReadFailed>
}

export const FileReader = Context.GenericTag<FileReaderPort>('application/FileReader')
