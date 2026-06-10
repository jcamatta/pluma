// Use case: hand a frontend tool's result back to the in-flight run. The renderer executed the tool the
// agent called and invokes agent:tool-result with the output; this resolves the suspended SDK tool
// handler (keyed by toolCallId) so the run continues. Delegates to the RuntimeAgent port.

import * as Effect from 'effect/Effect'
import type { AgentToolResultMessage } from '../data/agent-tool'
import { RuntimeAgent } from '../port/runtime-agent.port'
import type { RuntimeAgentPort } from '../port/runtime-agent.port'

export const submitToolResult = (
  message: AgentToolResultMessage
): Effect.Effect<void, never, RuntimeAgentPort> =>
  Effect.gen(function* () {
    const agent = yield* RuntimeAgent
    yield* agent.submitToolResult(message)
  })
