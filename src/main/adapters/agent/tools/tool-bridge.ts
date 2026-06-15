// The suspend point of the frontend-tool round-trip. The SDK runs a tool's handler in-process, but our
// tools act on the editor, which lives in the renderer. So each generated tool handler calls `callTool`:
// it emits an AgentToolCall to the renderer (via the injected sender) and returns a promise that stays
// pending until the renderer answers over agent:tool-result, at which point `resolve` settles it. The
// pending promises are keyed by toolCallId. On abort/teardown, `rejectAll` settles every outstanding
// call with an error result so no handler hangs and the SDK query can close.

import type { AgentToolCall, AgentToolResult } from '../../../application/agent/data/agent-tool'

type ToolCallSender = (call: AgentToolCall) => void

interface ToolBridge {
  // Emit the tool call to the renderer and await its result. Resolves when the renderer answers, or with
  // an error result if the run is torn down first.
  readonly callTool: (call: AgentToolCall) => Promise<AgentToolResult>
  // Settle a pending call with the renderer's answer. A toolCallId with no pending call is ignored.
  readonly resolve: (toolCallId: string, result: AgentToolResult) => void
  // Settle every outstanding call with an error (run aborted or completed before the renderer replied).
  readonly rejectAll: (reason: string) => void
}

export const createToolBridge = (send: ToolCallSender): ToolBridge => {
  const pending = new Map<string, (result: AgentToolResult) => void>()

  const callTool = (call: AgentToolCall): Promise<AgentToolResult> =>
    new Promise<AgentToolResult>((resolvePromise) => {
      pending.set(call.toolCallId, resolvePromise)
      send(call)
    })

  const resolve = (toolCallId: string, result: AgentToolResult): void => {
    const settle = pending.get(toolCallId)
    if (settle === undefined) return
    pending.delete(toolCallId)
    settle(result)
  }

  const rejectAll = (reason: string): void => {
    pending.forEach((settle) => settle({ ok: false, error: reason }))
    pending.clear()
  }

  return { callTool, resolve, rejectAll }
}

export type { ToolBridge, ToolCallSender }
