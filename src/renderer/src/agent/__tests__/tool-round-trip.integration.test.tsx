// The gate: a tool the model calls reaches the live editor and its result returns inside the run. This
// exercises the renderer half of the round-trip end to end against a real headless TipTap editor — the
// real propose_edit handler, the real registry, and useToolBridge — rather than faking one side. An
// agent:tool-call for propose_edit resolves the passage and stages a proposal; the proposal then exists
// in the editor's plugin state and the result returns on agent:tool-result. A gated file command instead
// flows through the approvals store + card and the user's answer returns on the same channel. Only
// window.api is faked, because IPC has no editor to talk to in a unit test.

import { describe, expect, it } from 'vitest'
import { fireEvent, render, renderHook, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
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
import { i18n } from '../../i18n'
import { ApprovalCardController } from '../../rail/ApprovalCard.controller'
import { AgentApprovalsProvider } from '../AgentApprovalsProvider'
import { useAgentApprovals } from '../AgentApprovalsContext'
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
          assertWire<{ readonly passage: string; readonly text: string }>(
            args,
            proposeEditTool.name
          )
          return proposeEdit({ editor, passage: args.passage, text: args.text })
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

// A registry with no tools: a gated call must never consult it, so an empty one proves the gated branch
// bypassed dispatch (a non-gated call would resolve to "unknown tool").
function emptyRegistry(): ToolRegistry {
  return {
    register: () => undefined,
    unregister: () => undefined,
    snapshot: () => [],
    byName: () => undefined
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
      // A non-gated call never reaches the approval seam, so a never-settling promise stands in for it.
      const noApproval = (): Promise<AgentToolResult> =>
        new Promise<AgentToolResult>(() => undefined)
      renderHook(() =>
        useToolBridge({ registry: editorRegistry(editor), requestApproval: noApproval }, api)
      )

      const proposed = await call({
        runId: 'run-1',
        toolCallId: 'tc-edit',
        toolName: proposeEditTool.name,
        args: { passage: 'world', text: 'earth' }
      })

      expect(proposed.ok).toBe(true)
      expect(getProposals(editor)).toHaveLength(1)
      expect(getProposals(editor)[0]?.replacementText).toBe('earth')
    } finally {
      editor.destroy()
    }
  })

  it('parks a gated file command on the approvals store and answers Approve as ok', async () => {
    const { api, call } = toolApi()

    // The bridge reads requestApproval from the live approvals store, so the card and the answer share
    // one instance — exactly the production wiring (App → AgentApprovalsProvider → AgentProvider).
    function GatedHarness(): React.JSX.Element {
      const { requestApproval } = useAgentApprovals()
      useToolBridge({ registry: emptyRegistry(), requestApproval }, api)
      return <ApprovalCardController />
    }

    render(
      <I18nextProvider i18n={i18n}>
        <AgentApprovalsProvider>
          <GatedHarness />
        </AgentApprovalsProvider>
      </I18nextProvider>
    )

    const answered = call({
      runId: 'run-1',
      toolCallId: 'tc-create',
      toolName: 'create_file',
      args: { path: '/notes/new.md' }
    })

    const approve = await screen.findByRole('button', { name: 'Approve' })
    expect(screen.getByText('/notes/new.md')).toBeInTheDocument()
    fireEvent.click(approve)

    const result = await answered
    expect(result).toEqual({ ok: true, output: { type: 'text', text: 'approved' } })
    expect(screen.queryByText('/notes/new.md')).toBeNull()
  })
})
