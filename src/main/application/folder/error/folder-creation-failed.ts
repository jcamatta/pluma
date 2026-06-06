// Typed failure: creating the folder failed for an unexpected filesystem reason.

import * as Data from 'effect/Data'

export class FolderCreationFailed extends Data.TaggedError('FolderCreationFailed')<{
  readonly path: string
}> {}
