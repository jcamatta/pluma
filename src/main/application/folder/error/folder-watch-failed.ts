// Typed failure: a watcher could not be established for the target folder.

import * as Data from 'effect/Data'

export class FolderWatchFailed extends Data.TaggedError('FolderWatchFailed')<{
  readonly path: string
}> {}
