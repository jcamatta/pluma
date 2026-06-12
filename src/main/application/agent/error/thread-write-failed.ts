// Typed failure: a thread write (rename or delete) could not be completed — the session is missing on
// disk or the SDK operation failed. Carries the workspace `cwd` the write targeted (structured data,
// not the raw cause text); the renderer maps the `_tag` to a translated message.

import * as Data from 'effect/Data'

export class ThreadWriteFailed extends Data.TaggedError('ThreadWriteFailed')<{
  readonly cwd: string
}> {}
