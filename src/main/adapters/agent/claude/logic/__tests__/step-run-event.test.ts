// Tests for stepRunEvent: the fold of one SDK message into AG-UI events. Covers the tool-result (user)
// branch and the no-op default; the init/result/stream_event branches delegate to calculations covered
// by their own tests.

import { EventType } from '@ag-ui/core'
import { describe, expect, it } from 'vitest'
import { newRunAccumulator, stepRunEvent } from '../step-run-event'

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
