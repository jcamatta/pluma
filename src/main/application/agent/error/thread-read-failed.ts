// Typed failure: a thread could not be read — the session is missing on disk or the read itself failed.
// Carries a short reason for diagnostics; the renderer maps the `_tag` to a translated message and never
// renders the reason as user-facing prose.

import * as Data from 'effect/Data'

export class ThreadReadFailed extends Data.TaggedError('ThreadReadFailed')<{
  readonly reason: string
}> {}
