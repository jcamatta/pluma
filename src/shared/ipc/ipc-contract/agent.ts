// Wire contracts for the agent channels. The agent input is built purely from @ag-ui/core types (a
// package both processes depend on), so the wire shape is declared here independently of the
// application layer's own RunAgentInput. The two are structurally identical, so the ipc handler hands
// the received input straight to the use case. agent:run returns only an ack carrying the minted runId:
// the BaseEvent stream cannot cross IPC, so events arrive on the separate agent:event event channel.

import type { Message, Tool } from '@ag-ui/core'
import type { IpcContractDefinition } from './types'

type EffortLevel = 'low' | 'medium' | 'high' | 'xhigh' | 'max'
type Model = 'claude-opus-4-8'

interface RunAgentState {
  readonly effort?: EffortLevel
  readonly model?: Model
}

interface RunAgentInput {
  readonly messages: readonly Message[]
  readonly threadId?: string
  readonly tools: readonly Tool[]
  readonly state?: RunAgentState
}

const AGENT_RUN_CHANNEL = 'agent:run'
const AGENT_ABORT_CHANNEL = 'agent:abort'

interface RunAgentError {
  readonly _tag: 'RunAgentFailed'
}

type AgentRunContract = IpcContractDefinition<
  typeof AGENT_RUN_CHANNEL,
  RunAgentInput,
  { readonly runId: string },
  RunAgentError
>

type AgentAbortContract = IpcContractDefinition<typeof AGENT_ABORT_CHANNEL, string, null, never>

export {
  AGENT_RUN_CHANNEL,
  AGENT_ABORT_CHANNEL,
  type RunAgentState,
  type RunAgentInput,
  type RunAgentError,
  type AgentRunContract,
  type AgentAbortContract
}
