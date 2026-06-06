// Use case: abort an in-flight agent run by id. Delegates to the RuntimeAgent port (named after AG-UI's
// AbstractAgent.abortRun). Aborting an unknown or already-finished run is a no-op, so this use case
// never fails.

import * as Effect from 'effect/Effect'
import { RuntimeAgent } from '../port/runtime-agent.port'
import type { RuntimeAgentPort } from '../port/runtime-agent.port'

export const abortAgent = (runId: string): Effect.Effect<void, never, RuntimeAgentPort> =>
  Effect.gen(function* () {
    const agent = yield* RuntimeAgent
    yield* agent.abort(runId)
  })
