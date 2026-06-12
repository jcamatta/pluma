// Typed failure: renaming the folder failed for an unexpected filesystem reason.

import * as Data from 'effect/Data'

export class FolderRenameFailed extends Data.TaggedError('FolderRenameFailed')<{
  readonly path: string
}> {}
