// The gate: a tool the model calls reaches the live editor and its result returns inside the run. This
// exercises the renderer half of the round-trip end to end against a real headless TipTap editor — the
// real propose_edit handler, the real registry, and useToolBridge — rather than faking one side. An
// agent:tool-call for propose_edit resolves the passage and stages a proposal; the proposal then exists
// in the editor's plugin state and the result returns on agent:tool-result. Only window.api is faked,
// because IPC has no editor to talk to in a unit test.

import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { Editor } from '@tiptap/core'
import type { IpcChannel, IpcInput, IpcResult } from '../../../../shared/ipc/ipc-contract'
import type { IpcEventCallback, IpcEventChannel } from '../../../../shared/ipc/ipc-event-contract'
import { AGENT_TOOL_RESULT_CHANNEL } from '../../../../shared/ipc/ipc-contract/agent'
import type { AgentToolResultMessage } from '../../../../shared/ipc/ipc-contract/agent'
import { AGENT_TOOL_CALL_CHANNEL } from '../../../../shared/ipc/ipc-event-contract/agent'
import type { AgentToolCall } from '../../../../shared/ipc/ipc-event-contract/agent'
import { assertWire } from '../../../../shared/ipc/from-wire'
import type { WindowApi } from '../../../../shared/ipc/window-api'
import { getProposals } from '../../editor/extensions/proposals'
import { createTestEditor } from '../../editor/extensions/__tests__/editor-test-harness'
import type { ToolEntry, ToolRegistry } from '../AgentToolsContext'
import { proposeEdit } from '../tools/tool-propose-edit'
import { proposeEditTool } from '../tools/specs'
import type { AgentToolResult } from '../tools/types'
import { useToolBridge } from '../useToolBridge'

// The real tool handler, bound to the editor under test, in a registry shaped like the live one. args is
// wire-shaped (unknown); the handler narrows it the same way the production registration would.
function editorRegistry(editor: Editor): ToolRegistry {
  const entries = new Map<string, ToolEntry>([
    [
      proposeEditTool.name,
      {
        spec: proposeEditTool,
        handler: (args) => {
          assertWire<{ readonly text: string; readonly replacementText: string }>(
            args,
            proposeEditTool.name
          )
          return proposeEdit(editor, args)
        }
      }
    ]
  ])

  return {
    register: () => undefined,
    unregister: () => undefined,
    snapshot: () => [...entries.values()].map((entry) => entry.spec),
    byName: (name) => entries.get(name)
  }
}

interface ToolApi {
  readonly api: WindowApi
  // Fire an agent:tool-call and resolve with the AgentToolResult the bridge sends back for it.
  readonly call: (call: AgentToolCall) => Promise<AgentToolResult>
}

// A WindowApi that delivers agent:tool-call to the bridge and captures the agent:tool-result it returns,
// matching each result to its call by toolCallId so `call` can resolve with it. on/invoke keep the
// preload's generic signatures (narrowing wire data via assertWire) so the fake needs no cast.
function toolApi(): ToolApi {
  const listeners = new Set<(payload: unknown) => void>()
  const answers = new Map<string, (result: AgentToolResult) => void>()

  const invoke = <Channel extends IpcChannel>(
    channel: Channel,
    ...args: IpcInput<Channel> extends void ? [] : [payload: IpcInput<Channel>]
  ): Promise<IpcResult<Channel>> => {
    if (channel === AGENT_TOOL_RESULT_CHANNEL) {
      const message: unknown = args[0]
      assertWire<AgentToolResultMessage>(message, channel)
      answers.get(message.toolCallId)?.(message.result)
    }
    const ack: unknown = { ok: true, value: null }
    assertWire<IpcResult<Channel>>(ack, channel)
    return Promise.resolve(ack)
  }

  const on = <Channel extends IpcEventChannel>(
    channel: Channel,
    callback: IpcEventCallback<Channel>
  ): (() => void) => {
    const listener = (payload: unknown): void => {
      assertWire<Parameters<IpcEventCallback<Channel>>[0]>(payload, channel)
      callback(payload)
    }
    if (channel === AGENT_TOOL_CALL_CHANNEL) listeners.add(listener)
    return () => listeners.delete(listener)
  }

  const api: WindowApi = { invoke, on }

  const call = (toolCall: AgentToolCall): Promise<AgentToolResult> =>
    new Promise((resolve) => {
      answers.set(toolCall.toolCallId, resolve)
      listeners.forEach((listener) => listener(toolCall))
    })

  return { api, call }
}

describe('frontend-tool round-trip (gate)', () => {
  it('lands a propose_edit proposal in the editor via the bridge', async () => {
    // createTestEditor (not withEditor) because the editor must outlive the awaits below; destroyed in
    // finally so its detached DOM node and plugins are torn down even if an assertion fails.
    const editor = createTestEditor('hello world')
    try {
      const { api, call } = toolApi()
      renderHook(() => useToolBridge(editorRegistry(editor), api))

      const proposed = await call({
        runId: 'run-1',
        toolCallId: 'tc-edit',
        toolName: proposeEditTool.name,
        args: { text: 'world', replacementText: 'earth' }
      })

      expect(proposed.ok).toBe(true)
      expect(getProposals(editor)).toHaveLength(1)
      expect(getProposals(editor)[0]?.replacementText).toBe('earth')
    } finally {
      editor.destroy()
    }
  })
})
