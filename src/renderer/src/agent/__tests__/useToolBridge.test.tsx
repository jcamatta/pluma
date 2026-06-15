// The suspended main run is keyed on toolCallId, so the bridge must answer every call: these cover the
// happy path plus the two ways a handler can fail to produce a result (no such tool, a rejection), each
// of which must still send an error result back, plus the gated branch — a mutating file command goes to
// requestApproval, NOT the registry, and its answer (approve → ok, reject → declined) is what is sent
// back. Driven by a fake WindowApi whose `on` callback `fire` invokes — no real IPC.

import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { IpcChannel, IpcInput, IpcResult } from '../../../../shared/ipc/ipc-contract'
import type { IpcEventCallback, IpcEventChannel } from '../../../../shared/ipc/ipc-event-contract'
import type { AgentToolResult } from '../../../../shared/ipc/ipc-contract/agent'
import { AGENT_TOOL_RESULT_CHANNEL } from '../../../../shared/ipc/ipc-contract/agent'
import { AGENT_TOOL_CALL_CHANNEL } from '../../../../shared/ipc/ipc-event-contract/agent'
import type { AgentToolCall } from '../../../../shared/ipc/ipc-event-contract/agent'
import { assertWire } from '../../../../shared/ipc/from-wire'
import type { WindowApi } from '../../../../shared/ipc/window-api'
import type { ToolEntry, ToolRegistry } from '../AgentToolsContext'
import { useToolBridge } from '../useToolBridge'

// The approval seam for non-gated tests: such a call must never reach it, so it returns a promise that
// never settles (the tests assert dispatch answered) — and the gated tests supply their own spy instead.
const noApproval = (): Promise<AgentToolResult> => new Promise<AgentToolResult>(() => undefined)

function fakeRegistry(entries: Map<string, ToolEntry['handler']>): ToolRegistry {
  return {
    register: () => undefined,
    unregister: () => undefined,
    snapshot: () => [],
    byName: (name) => {
      const handler = entries.get(name)
      return handler ? { spec: { name, description: '', parameters: {} }, handler } : undefined
    }
  }
}

interface FakeApi {
  readonly api: WindowApi
  readonly fire: (call: AgentToolCall) => void
  readonly invoke: ReturnType<typeof vi.fn>
}

// A WindowApi whose only live channels are agent:tool-call (fired by the test) and agent:tool-result
// (recorded). `on`/`invoke` keep the preload's generic signatures and cross the wire with assertWire —
// the project's sanctioned narrowing — so the fake satisfies WindowApi without a cast. `invoke` can't
// be a vi.fn directly (the mock wrapper erases its genericity), so it forwards to a recorder the tests
// assert against. The tool-call listener is captured as an unknown payload so `fire` can drive it.
function fakeApi(): FakeApi {
  const listeners = new Set<(payload: unknown) => void>()
  const recorder = vi.fn()

  const invoke = <Channel extends IpcChannel>(
    channel: Channel,
    ...args: IpcInput<Channel> extends void ? [] : [payload: IpcInput<Channel>]
  ): Promise<IpcResult<Channel>> => {
    recorder(channel, ...args)
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

  return { api, invoke: recorder, fire: (call) => listeners.forEach((listener) => listener(call)) }
}

const call: AgentToolCall = {
  runId: 'run-1',
  toolCallId: 'tc-1',
  toolName: 'propose_edit',
  args: { text: 'hello' }
}

describe('useToolBridge', () => {
  it('dispatches a tool call to its handler and sends the result back', async () => {
    const { api, fire, invoke } = fakeApi()
    const ok: AgentToolResult = { ok: true, output: { type: 'json', value: { proposalId: 'p_1' } } }
    const handler = vi.fn(() => ok)
    renderHook(() =>
      useToolBridge(
        {
          registry: fakeRegistry(new Map([['propose_edit', handler]])),
          requestApproval: noApproval
        },
        api
      )
    )

    fire(call)
    await vi.waitFor(() => expect(invoke).toHaveBeenCalled())

    expect(handler).toHaveBeenCalledWith({ text: 'hello' })
    expect(invoke).toHaveBeenCalledWith(AGENT_TOOL_RESULT_CHANNEL, {
      runId: 'run-1',
      toolCallId: 'tc-1',
      result: ok
    })
  })

  it('answers with an error result for an unknown tool name', async () => {
    const { api, fire, invoke } = fakeApi()
    renderHook(() =>
      useToolBridge({ registry: fakeRegistry(new Map()), requestApproval: noApproval }, api)
    )

    fire({ ...call, toolName: 'nope' })
    await vi.waitFor(() => expect(invoke).toHaveBeenCalled())

    expect(invoke).toHaveBeenCalledWith(AGENT_TOOL_RESULT_CHANNEL, {
      runId: 'run-1',
      toolCallId: 'tc-1',
      result: { ok: false, error: 'unknown tool: nope' }
    })
  })

  it('catches a rejecting handler and answers with an error result', async () => {
    const { api, fire, invoke } = fakeApi()
    const handler = vi.fn(() => Promise.reject(new Error('boom')))
    renderHook(() =>
      useToolBridge(
        {
          registry: fakeRegistry(new Map([['propose_edit', handler]])),
          requestApproval: noApproval
        },
        api
      )
    )

    fire(call)
    await vi.waitFor(() => expect(invoke).toHaveBeenCalled())

    expect(invoke).toHaveBeenCalledWith(AGENT_TOOL_RESULT_CHANNEL, {
      runId: 'run-1',
      toolCallId: 'tc-1',
      result: { ok: false, error: 'boom' }
    })
  })
})

describe('useToolBridge gated branch', () => {
  it('routes a gated tool call to requestApproval and never to the registry', async () => {
    const { api, fire, invoke } = fakeApi()
    const handled: AgentToolResult = { ok: true, output: { type: 'text', text: 'x' } }
    const handler = vi.fn(() => handled)
    const approved: AgentToolResult = { ok: true, output: { type: 'text', text: 'approved' } }
    const requestApproval = vi.fn(() => Promise.resolve(approved))
    renderHook(() =>
      useToolBridge(
        { registry: fakeRegistry(new Map([['create_file', handler]])), requestApproval },
        api
      )
    )

    const gated: AgentToolCall = {
      runId: 'run-1',
      toolCallId: 'tc-1',
      toolName: 'create_file',
      args: { path: '/notes/new.md' }
    }
    fire(gated)
    await vi.waitFor(() => expect(invoke).toHaveBeenCalled())

    expect(requestApproval).toHaveBeenCalledWith(gated)
    expect(handler).not.toHaveBeenCalled()
    expect(invoke).toHaveBeenCalledWith(AGENT_TOOL_RESULT_CHANNEL, {
      runId: 'run-1',
      toolCallId: 'tc-1',
      result: approved
    })
  })

  it('sends back the declined result when a gated approval is rejected', async () => {
    const { api, fire, invoke } = fakeApi()
    const declined: AgentToolResult = { ok: false, error: 'declined' }
    const requestApproval = vi.fn(() => Promise.resolve(declined))
    renderHook(() => useToolBridge({ registry: fakeRegistry(new Map()), requestApproval }, api))

    fire({ ...call, toolName: 'delete_file', args: { path: '/notes/old.md' } })
    await vi.waitFor(() => expect(invoke).toHaveBeenCalled())

    expect(invoke).toHaveBeenCalledWith(AGENT_TOOL_RESULT_CHANNEL, {
      runId: 'run-1',
      toolCallId: 'tc-1',
      result: declined
    })
  })
})
