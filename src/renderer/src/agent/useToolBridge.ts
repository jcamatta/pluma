// Runs a frontend tool the model called: subscribe to agent:tool-call, run the matching registered
// handler, and send its result back on agent:tool-result keyed by the same toolCallId. The main run is
// suspended on that toolCallId, so the bridge must always answer — an unknown tool name and a rejecting
// handler both resolve to an error result rather than escaping the subscription, or the run would hang.
// A gated tool call (a mutating file command) is NOT dispatched to a handler: it is parked as a human
// approval via requestApproval and answered on the same channel once the user decides. window.api is
// injected (defaulting to the global) so tests drive it with a fake.

import { useEffect } from 'react'
import { isGatedToolName } from '../../../shared/agent/gated-tools'
import {
  AGENT_TOOL_RESULT_CHANNEL,
  type AgentToolResult
} from '../../../shared/ipc/ipc-contract/agent'
import {
  AGENT_TOOL_CALL_CHANNEL,
  type AgentToolCall
} from '../../../shared/ipc/ipc-event-contract/agent'
import type { WindowApi } from '../../../shared/ipc/window-api'
import type { ToolRegistry } from './AgentToolsContext'

type RequestApproval = (call: AgentToolCall) => Promise<AgentToolResult>

// The two seams the bridge answers a call through: the frontend-tool registry (ungated) and the human
// approval store (gated). Bundled so the hook keeps within the project's two-parameter limit.
interface ToolBridgeDeps {
  readonly registry: ToolRegistry
  readonly requestApproval: RequestApproval
}

async function dispatch(registry: ToolRegistry, call: AgentToolCall): Promise<AgentToolResult> {
  const entry = registry.byName(call.toolName)
  if (!entry) return { ok: false, error: `unknown tool: ${call.toolName}` }

  try {
    return await entry.handler(call.args)
  } catch (error: unknown) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

function answer(deps: ToolBridgeDeps, call: AgentToolCall): Promise<AgentToolResult> {
  return isGatedToolName(call.toolName) ? deps.requestApproval(call) : dispatch(deps.registry, call)
}

export function useToolBridge(deps: ToolBridgeDeps, api: WindowApi = window.api): void {
  const { registry, requestApproval } = deps
  useEffect(() => {
    return api.on(AGENT_TOOL_CALL_CHANNEL, (call) => {
      void answer({ registry, requestApproval }, call).then((result) =>
        api.invoke(AGENT_TOOL_RESULT_CHANNEL, {
          runId: call.runId,
          toolCallId: call.toolCallId,
          result
        })
      )
    })
  }, [registry, requestApproval, api])
}

export type { ToolBridgeDeps }
