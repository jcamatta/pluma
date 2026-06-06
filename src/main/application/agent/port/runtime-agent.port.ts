// Port for the runtime agent. The use case depends on this interface, never on a concrete SDK. `run`
// starts a run for a conversation and returns the minted runId together with a Stream of AG-UI events
// (@ag-ui/core BaseEvent) describing the agent's reply as it unfolds. `abort` stops the in-flight run by
// id (named after AG-UI's AbstractAgent.abortRun). The adapter (in adapters/) implements this over the
// Claude SDK; tests provide an in-memory fake.

import * as Context from 'effect/Context'
import type * as Effect from 'effect/Effect'
import type { RunAgentInput } from '../data/run-agent-input'
import type { RunAgentOutput } from '../data/run-agent-output'
import type { RunAgentFailed } from '../error/run-agent-failed'

export interface RuntimeAgentPort {
  readonly run: (input: RunAgentInput) => Effect.Effect<RunAgentOutput, RunAgentFailed>
  readonly abort: (runId: string) => Effect.Effect<void>
}

export const RuntimeAgent = Context.GenericTag<RuntimeAgentPort>('application/RuntimeAgent')
