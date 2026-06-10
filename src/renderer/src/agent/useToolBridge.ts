// Runs a frontend tool the model called: subscribe to agent:tool-call, run the matching registered
// handler, and send its result back on agent:tool-result keyed by the same toolCallId. The main run is
// suspended on that toolCallId, so the bridge must always answer — an unknown tool name and a rejecting
// handler both resolve to an error result rather than escaping the subscription, or the run would hang.
// window.api is injected (defaulting to the global) so tests drive it with a fake.

import { useEffect } from 'react'
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

async function dispatch(registry: ToolRegistry, call: AgentToolCall): Promise<AgentToolResult> {
  const entry = registry.byName(call.toolName)
  if (!entry) return { ok: false, error: `unknown tool: ${call.toolName}` }

  try {
    return await entry.handler(call.args)
  } catch (error: unknown) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export function useToolBridge(registry: ToolRegistry, api: WindowApi = window.api): void {
  useEffect(() => {
    return api.on(AGENT_TOOL_CALL_CHANNEL, (call) => {
      void dispatch(registry, call).then((result) =>
        api.invoke(AGENT_TOOL_RESULT_CHANNEL, {
          runId: call.runId,
          toolCallId: call.toolCallId,
          result
        })
      )
    })
  }, [registry, api])
}
