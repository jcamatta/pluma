// Typed failure: the given path does not target a markdown (.md) file.

import * as Data from 'effect/Data'

export class InvalidPath extends Data.TaggedError('InvalidPath')<{
  readonly path: string
}> {}
