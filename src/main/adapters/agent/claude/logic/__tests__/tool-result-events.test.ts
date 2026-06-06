// Tests for toolResultEvents: the calculation turning the SDK's echoed tool_result blocks into AG-UI
// TOOL_CALL_RESULT events. Covers string content, array content flattened to text, and that non-result
// content (and plain-string messages) produce nothing.

import { EventType } from '@ag-ui/core'
import { describe, expect, it } from 'vitest'
import type { UserContent } from '../../data/sdk-types'
import { toolResultEvents } from '../tool-result-events'

describe('toolResultEvents', () => {
  it('maps a tool_result with string content to a TOOL_CALL_RESULT event', () => {
    const content: UserContent = [{ type: 'tool_result', tool_use_id: 'call-1', content: 'done' }]

    expect(toolResultEvents(content)).toStrictEqual([
      {
        type: EventType.TOOL_CALL_RESULT,
        messageId: 'result-call-1',
        toolCallId: 'call-1',
        content: 'done',
        role: 'tool'
      }
    ])
  })

  it('flattens array text content and ignores non-text blocks', () => {
    const content: UserContent = [
      {
        type: 'tool_result',
        tool_use_id: 'call-2',
        content: [
          { type: 'text', text: 'line one' },
          { type: 'text', text: 'line two' }
        ]
      }
    ]

    expect(toolResultEvents(content)[0].content).toBe('line one\nline two')
  })

  it('returns nothing for plain-string messages and non-result blocks', () => {
    expect(toolResultEvents('just text')).toStrictEqual([])
    expect(toolResultEvents([{ type: 'text', text: 'hi' }])).toStrictEqual([])
  })
})
