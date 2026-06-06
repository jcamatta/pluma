// Port for reading folders on disk. The use case depends on this interface, never on a concrete
// filesystem. The adapter (in adapters/) implements it; tests provide an in-memory fake. Kept
// separate from FolderWriter so reads and mutations stay segregated.

import * as Context from 'effect/Context'
import type * as Effect from 'effect/Effect'
import type { FolderEntry } from '../data/entry'
import type { FolderNotFound } from '../error/folder-not-found'
import type { FolderReadFailed } from '../error/folder-read-failed'

export interface FolderReaderPort {
  readonly listFolder: (
    path: string
  ) => Effect.Effect<ReadonlyArray<FolderEntry>, FolderNotFound | FolderReadFailed>
}

export const FolderReader = Context.GenericTag<FolderReaderPort>('application/FolderReader')
