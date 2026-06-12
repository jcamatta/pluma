// Typed failure: a thread could not be read — the session is missing on disk or the read itself failed.
// Carries the workspace `cwd` the read targeted (structured data, not the raw cause text); the renderer
// maps the `_tag` to a translated message.

import * as Data from 'effect/Data'

export class ThreadReadFailed extends Data.TaggedError('ThreadReadFailed')<{
  readonly cwd: string
}> {}
