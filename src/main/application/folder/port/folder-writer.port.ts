// Port for creating folders on disk. The use case depends on this interface, never on a concrete
// filesystem. The adapter (in adapters/) implements it; tests provide an in-memory fake.

import * as Context from 'effect/Context'
import type * as Effect from 'effect/Effect'
import type { FolderAlreadyExists } from '../error/folder-already-exists'
import type { ParentDirectoryNotFound } from '../error/parent-directory-not-found'
import type { FolderCreationFailed } from '../error/folder-creation-failed'

export interface FolderWriterPort {
  readonly createFolder: (
    path: string
  ) => Effect.Effect<void, FolderAlreadyExists | ParentDirectoryNotFound | FolderCreationFailed>
}

export const FolderWriter = Context.GenericTag<FolderWriterPort>('application/FolderWriter')
