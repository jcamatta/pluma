// Typed failure: reading the folder's contents failed for an unexpected filesystem reason.

import * as Data from 'effect/Data'

export class FolderReadFailed extends Data.TaggedError('FolderReadFailed')<{
  readonly path: string
}> {}
