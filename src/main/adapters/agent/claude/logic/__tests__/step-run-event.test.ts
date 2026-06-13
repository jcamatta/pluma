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

describe('stepRunEvent result handling', () => {
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

  it('reports a generic reason when a result is flagged in error but typed success', () => {
    const acc = newRunAccumulator()
    const [, events] = stepRunEvent('run-1')(acc, resultMessage('success', true))

    expect(events).toStrictEqual([
      { type: EventType.RUN_ERROR, runId: 'run-1', message: 'agent run failed' }
    ])
  })
})

describe('stepRunEvent message routing', () => {
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

  it('opens the run and fixes the threadId on system/init', () => {
    const acc = newRunAccumulator()
    const init = { type: 'system', subtype: 'init', session_id: 'thread-9' }
    asSdkMessage(init)
    const [next, events] = stepRunEvent('run-1')(acc, init)

    expect(next.threadId).toBe('thread-9')
    expect(events).toStrictEqual([
      { type: EventType.RUN_STARTED, threadId: 'thread-9', runId: 'run-1' }
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

  it('adopts the message id from message_start and mints text ids that do not collide across messages', () => {
    const messageStart = (id: string): SDKMessage => {
      const literal = { type: 'stream_event', event: { type: 'message_start', message: { id } } }
      asSdkMessage(literal)
      return literal
    }
    const textBlock = (): SDKMessage => {
      const literal = {
        type: 'stream_event',
        event: {
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'text', text: '', citations: null }
        }
      }
      asSdkMessage(literal)
      return literal
    }
    const step = stepRunEvent('run-1')

    // First assistant message: its text block is keyed by msg_a.
    const [acc1, started] = step(newRunAccumulator(), messageStart('msg_a'))
    expect(started).toStrictEqual([])
    const [acc2, first] = step(acc1, textBlock())
    expect(first).toStrictEqual([
      { type: EventType.TEXT_MESSAGE_START, messageId: 'msg_a-block-0', role: 'assistant' }
    ])

    // A second assistant message in the same run restarts at index 0 but, keyed by msg_b, gets a
    // distinct id — the collision that previously bled text into the prior message.
    const [acc3] = step(acc2, messageStart('msg_b'))
    const [, second] = step(acc3, textBlock())
    expect(second).toStrictEqual([
      { type: EventType.TEXT_MESSAGE_START, messageId: 'msg_b-block-0', role: 'assistant' }
    ])
  })
})
