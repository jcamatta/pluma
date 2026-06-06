// Typed failure: opening the native folder-picker dialog failed for an unexpected reason.

import * as Data from 'effect/Data'

export class FolderSelectionFailed extends Data.TaggedError('FolderSelectionFailed')<
  Record<string, never>
> {}
