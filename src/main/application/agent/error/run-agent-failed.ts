// Typed failure: an agent run could not be started. Carries the runId so the renderer can tie the
// failure back to the run it requested.

import * as Data from 'effect/Data'

export class RunAgentFailed extends Data.TaggedError('RunAgentFailed')<{
  readonly runId: string
}> {}
