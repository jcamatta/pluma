// Port for the runtime agent. The use case depends on this interface, never on a concrete SDK. `run`
// starts a run for a conversation and returns the minted runId together with a Stream of AG-UI events
// (@ag-ui/core BaseEvent) describing the agent's reply as it unfolds. When the agent calls a frontend
// tool, the run emits an AgentToolCall through the `sendToolCall` callback and suspends until the
// renderer answers via `submitToolResult`. `abort` stops the in-flight run by id (named after AG-UI's
// AbstractAgent.abortRun). The adapter (in adapters/) implements this over the Claude SDK; tests provide
// an in-memory fake.

import * as Context from 'effect/Context'
import type * as Effect from 'effect/Effect'
import type { AgentToolCall, AgentToolResultMessage } from '../data/agent-tool'
import type { RunAgentInput } from '../data/run-agent-input'
import type { RunAgentOutput } from '../data/run-agent-output'
import type { RunAgentFailed } from '../error/run-agent-failed'

type SendToolCall = (call: AgentToolCall) => void

interface RuntimeAgentPort {
  readonly run: (
    input: RunAgentInput,
    sendToolCall: SendToolCall
  ) => Effect.Effect<RunAgentOutput, RunAgentFailed>
  readonly submitToolResult: (message: AgentToolResultMessage) => Effect.Effect<void>
  readonly abort: (runId: string) => Effect.Effect<void>
}

const RuntimeAgent = Context.GenericTag<RuntimeAgentPort>('application/RuntimeAgent')

export { RuntimeAgent, type RuntimeAgentPort, type SendToolCall }
