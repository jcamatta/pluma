// Typed failure: a thread write (rename or delete) could not be completed — the session is missing on
// disk or the SDK operation failed. Carries a short reason for diagnostics; the renderer maps the
// `_tag` to a translated message and never renders the reason as user-facing prose.

import * as Data from 'effect/Data'

export class ThreadWriteFailed extends Data.TaggedError('ThreadWriteFailed')<{
  readonly reason: string
}> {}
