// Typed failure: no folder exists at the target path.

import * as Data from 'effect/Data'

export class FolderNotFound extends Data.TaggedError('FolderNotFound')<{
  readonly path: string
}> {}
