// Typed failure: the parent directory of the target folder does not exist.

import * as Data from 'effect/Data'

export class ParentDirectoryNotFound extends Data.TaggedError('ParentDirectoryNotFound')<{
  readonly path: string
}> {}
