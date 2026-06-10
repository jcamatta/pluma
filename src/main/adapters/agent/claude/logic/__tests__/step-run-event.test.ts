// Tests for stepRunEvent: the fold of one SDK message into AG-UI events. Covers the tool-result (user)
// branch and the no-op default; the init/result/stream_event branches delegate to calculations covered
// by their own tests.

import { EventType } from '@ag-ui/core'
import type { SDKMessage, SDKResultMessage } from '@anthropic-ai/claude-agent-sdk'
import { describe, expect, it } from 'vitest'
import { newRunAccumulator, stepRunEvent } from '../step-run-event'

// A result message carries many fields the fold ignores; the branch reads only subtype and is_error. We
// build a literal with just those and trust it as an SDKMessage at this test boundary via an `asserts`
// narrowing (the same no-cast tool the production code uses), so each test states only what it exercises.
function asSdkMessage(literal: { type: string }): asserts literal is SDKMessage {
  void literal
}

const resultMessage = (subtype: SDKResultMessage['subtype'], isError: boolean): SDKMessage => {
  const literal = { type: 'result', subtype, is_error: isError }
  asSdkMessage(literal)
  return literal
}

describe('stepRunEvent', () => {
  it('maps a user message with a tool_result to a TOOL_CALL_RESULT event', () => {
    const acc = newRunAccumulator()
    const [next, events] = stepRunEvent('run-1')(acc, {
      type: 'user',
      parent_tool_use_id: null,
      message: {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: 'c1', content: 'ok' }]
      }
    })

    expect(next).toBe(acc)
    expect(events).toStrictEqual([
      {
        type: EventType.TOOL_CALL_RESULT,
        messageId: 'result-c1',
        toolCallId: 'c1',
        content: 'ok',
        role: 'tool'
      }
    ])
  })

  it('finishes the run on a successful result', () => {
    const acc = newRunAccumulator()
    const [, events] = stepRunEvent('run-1')(acc, resultMessage('success', false))

    expect(events).toStrictEqual([
      {
        type: EventType.RUN_FINISHED,
        threadId: acc.threadId,
        runId: 'run-1',
        outcome: { type: 'success' }
      }
    ])
  })

  it('errors the run on a failed result instead of a false finish', () => {
    const acc = newRunAccumulator()
    const [, events] = stepRunEvent('run-1')(acc, resultMessage('error_during_execution', true))

    expect(events).toStrictEqual([
      { type: EventType.RUN_ERROR, runId: 'run-1', message: 'error_during_execution' }
    ])
  })

  it('emits nothing for an unrelated message type', () => {
    const acc = newRunAccumulator()
    const [next, events] = stepRunEvent('run-1')(acc, {
      type: 'user',
      parent_tool_use_id: null,
      message: { role: 'user', content: 'plain text' }
    })

    expect(next).toBe(acc)
    expect(events).toStrictEqual([])
  })
})
