// Port for watching a folder for filesystem changes. The use case depends on this interface, never on
// a concrete watcher. The adapter (in adapters/) implements it; tests provide an in-memory fake. The
// returned Stream stays live for as long as the ambient Scope is open; closing the Scope releases the
// underlying OS subscription.

import * as Context from 'effect/Context'
import type * as Effect from 'effect/Effect'
import type * as Scope from 'effect/Scope'
import type * as Stream from 'effect/Stream'
import type { FileEvent } from '../data/file-event'
import type { FolderWatchFailed } from '../error/folder-watch-failed'

export interface FolderWatcherPort {
  readonly watch: (
    path: string
  ) => Effect.Effect<Stream.Stream<FileEvent>, FolderWatchFailed, Scope.Scope>
}

export const FolderWatcher = Context.GenericTag<FolderWatcherPort>('application/FolderWatcher')
