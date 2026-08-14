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

// The fold's run-wide deps: the runId stamped on events and the model's context window (meter
// denominator). 1M matches the offered models, so an assistant message's usage maps against it.
const deps = { runId: 'run-1', contextWindow: 1_000_000 }

const resultMessage = (subtype: SDKResultMessage['subtype'], isError: boolean): SDKMessage => {
  const literal = { type: 'result', subtype, is_error: isError }
  asSdkMessage(literal)
  return literal
}

describe('stepRunEvent result handling', () => {
  it('finishes the run on a successful result', () => {
    const acc = newRunAccumulator()
    const [, events] = stepRunEvent(deps)(acc, resultMessage('success', false))

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
    const [, events] = stepRunEvent(deps)(acc, resultMessage('error_during_execution', true))

    expect(events).toStrictEqual([
      {
        type: EventType.RUN_ERROR,
        runId: 'run-1',
        message: 'error_during_execution',
        code: 'generic'
      }
    ])
  })

  it('reports a generic reason when a result is flagged in error but typed success', () => {
    const acc = newRunAccumulator()
    const [, events] = stepRunEvent(deps)(acc, resultMessage('success', true))

    expect(events).toStrictEqual([
      { type: EventType.RUN_ERROR, runId: 'run-1', message: 'agent run failed', code: 'generic' }
    ])
  })
})

describe('stepRunEvent failure code', () => {
  const failedAssistant = (id: string): SDKMessage => {
    const literal = {
      type: 'assistant',
      error: 'authentication_failed',
      message: { id, usage: { input_tokens: 1 } }
    }
    asSdkMessage(literal)
    return literal
  }

  it('stamps the reason an assistant message reported onto the failing result', () => {
    const step = stepRunEvent(deps)
    const [acc] = step(newRunAccumulator(), failedAssistant('msg_a'))
    const [, events] = step(acc, resultMessage('success', true))

    expect(events).toStrictEqual([
      {
        type: EventType.RUN_ERROR,
        runId: 'run-1',
        message: 'agent run failed',
        code: 'authentication'
      }
    ])
  })

  it('records the reason even when the assistant message repeats an earlier id', () => {
    const step = stepRunEvent(deps)
    const [acc1] = step(newRunAccumulator(), failedAssistant('msg_a'))
    // Parallel tool calls reuse one message id, so this second message takes the duplicate-id path.
    const [acc2, repeated] = step({ ...acc1, failure: 'generic' }, failedAssistant('msg_a'))
    const [, events] = step(acc2, resultMessage('success', true))

    expect(repeated).toStrictEqual([])
    expect(events).toStrictEqual([
      {
        type: EventType.RUN_ERROR,
        runId: 'run-1',
        message: 'agent run failed',
        code: 'authentication'
      }
    ])
  })

  it('leaves an assistant message that reported no error on the generic reason', () => {
    const clean = { type: 'assistant', message: { id: 'msg_a', usage: { input_tokens: 1 } } }
    asSdkMessage(clean)
    const step = stepRunEvent(deps)
    const [acc] = step(newRunAccumulator(), clean)

    expect(acc.failure).toBe('generic')
    expect(step(acc, resultMessage('success', false))[1]).toStrictEqual([
      { type: EventType.RUN_FINISHED, threadId: '', runId: 'run-1', outcome: { type: 'success' } }
    ])
  })
})

describe('stepRunEvent message routing', () => {
  it('maps a user message with a tool_result to a TOOL_CALL_RESULT event', () => {
    const acc = newRunAccumulator()
    const [next, events] = stepRunEvent(deps)(acc, {
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
    const [next, events] = stepRunEvent(deps)(acc, init)

    expect(next.threadId).toBe('thread-9')
    expect(events).toStrictEqual([
      { type: EventType.RUN_STARTED, threadId: 'thread-9', runId: 'run-1' }
    ])
  })

  it('emits nothing for an unrelated message type', () => {
    const acc = newRunAccumulator()
    const [next, events] = stepRunEvent(deps)(acc, {
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
    const step = stepRunEvent(deps)

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

describe('stepRunEvent context usage', () => {
  const assistant = (id: string): SDKMessage => {
    const literal = {
      type: 'assistant',
      message: {
        id,
        usage: {
          input_tokens: 1200,
          cache_read_input_tokens: 11_000,
          cache_creation_input_tokens: 200
        }
      }
    }
    asSdkMessage(literal)
    return literal
  }

  it('publishes a context snapshot from an assistant message usage', () => {
    const [, events] = stepRunEvent(deps)(newRunAccumulator(), assistant('msg_a'))

    expect(events).toStrictEqual([
      {
        type: EventType.STATE_SNAPSHOT,
        snapshot: {
          contextUsage: {
            usedTokens: 12_400,
            windowTokens: 1_000_000,
            breakdown: { inputTokens: 1200, cacheReadTokens: 11_000, cacheCreationTokens: 200 }
          }
        }
      }
    ])
  })

  it('skips a repeated assistant id so the same figure is not re-emitted', () => {
    const [next] = stepRunEvent(deps)(newRunAccumulator(), assistant('msg_a'))
    const [, again] = stepRunEvent(deps)(next, assistant('msg_a'))

    expect(again).toStrictEqual([])
  })
})
