// Typed failure: the file's MIME type is not an image type we store in the workspace assets folder.

import * as Data from 'effect/Data'

export class UnsupportedImageType extends Data.TaggedError('UnsupportedImageType')<{
  readonly mimeType: string
}> {}
