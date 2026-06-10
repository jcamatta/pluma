// Tests for the tool bridge: the suspend/resolve mechanism behind the frontend-tool round-trip. A
// callTool emits the call to the renderer and stays pending until resolve settles it; rejectAll settles
// every outstanding call with an error; an unknown toolCallId is ignored.

import { describe, expect, it, vi } from 'vitest'
import type { AgentToolCall } from '../../../../../application/agent/data/agent-tool'
import { createToolBridge } from '../tool-bridge'

const call = (toolCallId: string): AgentToolCall => ({
  runId: 'run-1',
  toolCallId,
  toolName: 'propose_edit',
  args: {}
})

describe('createToolBridge', () => {
  it('emits the call to the renderer and resolves the pending promise on the matching result', async () => {
    const send = vi.fn()
    const bridge = createToolBridge(send)

    const pending = bridge.callTool(call('t1'))
    expect(send).toHaveBeenCalledWith(call('t1'))

    bridge.resolve('t1', { ok: true, output: { type: 'text', text: 'done' } })

    await expect(pending).resolves.toStrictEqual({
      ok: true,
      output: { type: 'text', text: 'done' }
    })
  })

  it('ignores a result for an unknown toolCallId', async () => {
    const bridge = createToolBridge(vi.fn())
    const pending = bridge.callTool(call('t1'))

    bridge.resolve('other', { ok: false, error: 'nope' })
    bridge.resolve('t1', { ok: true, output: { type: 'text', text: 'ok' } })

    await expect(pending).resolves.toStrictEqual({ ok: true, output: { type: 'text', text: 'ok' } })
  })

  it('settles every outstanding call with an error when rejectAll is called', async () => {
    const bridge = createToolBridge(vi.fn())
    const a = bridge.callTool(call('a'))
    const b = bridge.callTool(call('b'))

    bridge.rejectAll('aborted')

    await expect(a).resolves.toStrictEqual({ ok: false, error: 'aborted' })
    await expect(b).resolves.toStrictEqual({ ok: false, error: 'aborted' })
  })

  it('does not resolve a call twice (resolve after rejectAll is a no-op)', async () => {
    const bridge = createToolBridge(vi.fn())
    const pending = bridge.callTool(call('t1'))

    bridge.rejectAll('aborted')
    bridge.resolve('t1', { ok: true, output: { type: 'text', text: 'late' } })

    await expect(pending).resolves.toStrictEqual({ ok: false, error: 'aborted' })
  })
})
