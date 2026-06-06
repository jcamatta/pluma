// Typed failure: a file or folder already exists at the target path.

import * as Data from 'effect/Data'

export class FolderAlreadyExists extends Data.TaggedError('FolderAlreadyExists')<{
  readonly path: string
}> {}
