// Typed failure: deleting the file failed for an unexpected filesystem reason.

import * as Data from 'effect/Data'

export class FileDeleteFailed extends Data.TaggedError('FileDeleteFailed')<{
  readonly path: string
}> {}
