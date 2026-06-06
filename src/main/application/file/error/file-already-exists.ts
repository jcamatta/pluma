// Typed failure: a file already exists at the target path.

import * as Data from 'effect/Data'

export class FileAlreadyExists extends Data.TaggedError('FileAlreadyExists')<{
  readonly path: string
}> {}
