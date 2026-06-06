// Typed failure: deleting the folder failed for an unexpected filesystem reason.

import * as Data from 'effect/Data'

export class FolderDeleteFailed extends Data.TaggedError('FolderDeleteFailed')<{
  readonly path: string
}> {}
