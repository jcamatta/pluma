// Tests for gatedUseCaseTool against a fake bridge: an approval runs the gated effect and folds its
// success into the tool result, a declined approval returns the 'declined' result WITHOUT running the
// effect, and a typed failure under approval surfaces its _tag as the error.

import * as Data from 'effect/Data'
import * as Effect from 'effect/Effect'
import { describe, expect, it } from 'vitest'
import type { AgentToolCall, AgentToolResult } from '../../../../application/agent/data/agent-tool'
import { gatedUseCaseTool } from '../gated-use-case-tool'
import type { ToolBridge } from '../tool-bridge'

class FakeError extends Data.TaggedError('FakeError')<{ readonly path: string }> {}

const fakeBridge = (answer: AgentToolResult): { bridge: ToolBridge; calls: AgentToolCall[] } => {
  const calls: AgentToolCall[] = []
  const bridge: ToolBridge = {
    callTool: (call) => {
      calls.push(call)
      return Promise.resolve(answer)
    },
    resolve: () => undefined,
    rejectAll: () => undefined
  }
  return { bridge, calls }
}

describe('gatedUseCaseTool', () => {
  it('runs the effect and folds its success into the result when approved', async () => {
    const { bridge, calls } = fakeBridge({ ok: true, output: { type: 'text', text: 'ignored' } })

    const result = await Effect.runPromise(
      gatedUseCaseTool({
        bridge,
        runId: 'run-1',
        toolName: 'create_file',
        args: { path: '/abs/note.md' },
        effect: Effect.succeed('/abs/note.md'),
        toOutput: (value) => ({ type: 'text', text: value }),
        fallback: 'create_file_failed'
      })
    )

    expect(result).toEqual({ ok: true, output: { type: 'text', text: '/abs/note.md' } })
    expect(calls).toEqual([
      expect.objectContaining({
        runId: 'run-1',
        toolName: 'create_file',
        args: { path: '/abs/note.md' }
      })
    ])
  })

  it('returns declined and never runs the effect when rejected', async () => {
    const { bridge } = fakeBridge({ ok: false, error: 'declined' })
    const ran = { value: false }

    const result = await Effect.runPromise(
      gatedUseCaseTool({
        bridge,
        runId: 'run-1',
        toolName: 'delete_file',
        args: { path: '/abs/note.md' },
        effect: Effect.sync(() => {
          ran.value = true
          return '/abs/note.md'
        }),
        toOutput: (value) => ({ type: 'text', text: value }),
        fallback: 'delete_file_failed'
      })
    )

    expect(result).toEqual({ ok: false, error: 'declined' })
    expect(ran.value).toBe(false)
  })

  it('surfaces a typed failure _tag as the error when approved', async () => {
    const { bridge } = fakeBridge({ ok: true, output: { type: 'text', text: 'ignored' } })

    const result = await Effect.runPromise(
      gatedUseCaseTool({
        bridge,
        runId: 'run-1',
        toolName: 'create_file',
        args: { path: '/abs/note.md' },
        effect: Effect.fail(new FakeError({ path: '/abs/note.md' })),
        toOutput: (value: string) => ({ type: 'text', text: value }),
        fallback: 'create_file_failed'
      })
    )

    expect(result).toEqual({ ok: false, error: 'FakeError' })
  })
})
