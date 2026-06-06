// Typed failure: writing the file failed for an unexpected filesystem reason.

import * as Data from 'effect/Data'

export class FileWriteFailed extends Data.TaggedError('FileWriteFailed')<{
  readonly path: string
}> {}
