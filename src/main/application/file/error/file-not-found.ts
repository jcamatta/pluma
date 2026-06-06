// Typed failure: no file exists at the target path.

import * as Data from 'effect/Data'

export class FileNotFound extends Data.TaggedError('FileNotFound')<{
  readonly path: string
}> {}
