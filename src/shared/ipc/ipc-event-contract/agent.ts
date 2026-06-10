// Event contracts for AG-UI agent events. Once a run starts, main pushes each @ag-ui/core BaseEvent on
// agent:event; the renderer subscribes via window.api.on and feeds them to the AG-UI client.
//
// agent:tool-call is the main → renderer half of the frontend-tool round-trip: when the model calls a
// tool the renderer registered, main suspends the run and pushes an AgentToolCall, then awaits the
// answer the renderer sends back over the agent:tool-result invoke channel (see ipc-contract/agent).

import type { BaseEvent } from '@ag-ui/core'
import type { IpcEventContractDefinition } from './types'

const AGENT_EVENT_CHANNEL = 'agent:event'
const AGENT_TOOL_CALL_CHANNEL = 'agent:tool-call'

// A frontend tool the model invoked, to be executed by the renderer. `args` is unvalidated wire data
// (validated renderer-side against the tool spec); `toolCallId` ties it to its result.
interface AgentToolCall {
  readonly runId: string
  readonly toolCallId: string
  readonly toolName: string
  readonly args: unknown
}

type AgentEventContract = IpcEventContractDefinition<typeof AGENT_EVENT_CHANNEL, BaseEvent>

type AgentToolCallContract = IpcEventContractDefinition<
  typeof AGENT_TOOL_CALL_CHANNEL,
  AgentToolCall
>

export {
  AGENT_EVENT_CHANNEL,
  AGENT_TOOL_CALL_CHANNEL,
  type AgentToolCall,
  type AgentEventContract,
  type AgentToolCallContract
}
