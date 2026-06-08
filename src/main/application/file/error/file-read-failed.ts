// Typed failure: reading the file's content failed for an unexpected filesystem reason.

import * as Data from 'effect/Data'

export class FileReadFailed extends Data.TaggedError('FileReadFailed')<{
  readonly path: string
}> {}
