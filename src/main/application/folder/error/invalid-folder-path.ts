// Typed failure: the given path is not a valid folder path (empty).

import * as Data from 'effect/Data'

export class InvalidFolderPath extends Data.TaggedError('InvalidFolderPath')<{
  readonly path: string
}> {}
