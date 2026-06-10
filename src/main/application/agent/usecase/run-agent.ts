// Use case: start an agent run for a prompt. Delegates to the RuntimeAgent port, which mints the runId
// and returns the live Stream of AG-UI events. The IPC endpoint subscribes to that stream and forwards
// each event to the renderer, the same way folder:watch forwards file events.

import * as Effect from 'effect/Effect'
import type { RunAgentInput } from '../data/run-agent-input'
import type { RunAgentOutput } from '../data/run-agent-output'
import type { RunAgentFailed } from '../error/run-agent-failed'
import { RuntimeAgent } from '../port/runtime-agent.port'
import type { RuntimeAgentPort, SendToolCall } from '../port/runtime-agent.port'

export const runAgent = (
  input: RunAgentInput,
  sendToolCall: SendToolCall
): Effect.Effect<RunAgentOutput, RunAgentFailed, RuntimeAgentPort> =>
  Effect.gen(function* () {
    const agent = yield* RuntimeAgent
    return yield* agent.run(input, sendToolCall)
  })
