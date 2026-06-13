// Typed failure: renaming the file failed for an unexpected filesystem reason.

import * as Data from 'effect/Data'

export class FileRenameFailed extends Data.TaggedError('FileRenameFailed')<{
  readonly path: string
}> {}
