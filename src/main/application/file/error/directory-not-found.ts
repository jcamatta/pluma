// Typed failure: the parent directory of the target path does not exist.

import * as Data from 'effect/Data'

export class DirectoryNotFound extends Data.TaggedError('DirectoryNotFound')<{
  readonly path: string
}> {}
