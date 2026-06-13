// Typed failure: writing the image bytes into the workspace assets folder failed for a filesystem reason.

import * as Data from 'effect/Data'

export class AssetWriteFailed extends Data.TaggedError('AssetWriteFailed')<{
  readonly path: string
}> {}
