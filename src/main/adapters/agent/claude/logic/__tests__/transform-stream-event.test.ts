// Tests for transformStreamEvent: the calculation mapping Claude SDK stream events to AG-UI events.
// Covers text and tool_use blocks across start/delta/stop, correlation through the blocks map, and the
// null cases (unknown block kinds, deltas for an unopened index).

import { EventType } from '@ag-ui/core'
import { describe, expect, it } from 'vitest'
import type { OpenBlock, StreamEvent } from '../../data/sdk-types'
import { transformStreamEvent } from '../transform-stream-event'

const textStart = (index: number): StreamEvent => ({
  type: 'content_block_start',
  index,
  content_block: { type: 'text', text: '', citations: null }
})

const toolStart = (index: number, tool: { id: string; name: string }): StreamEvent => ({
  type: 'content_block_start',
  index,
  content_block: { type: 'tool_use', id: tool.id, name: tool.name, input: {} }
})

const textDelta = (index: number, text: string): StreamEvent => ({
  type: 'content_block_delta',
  index,
  delta: { type: 'text_delta', text }
})

const jsonDelta = (index: number, partial: string): StreamEvent => ({
  type: 'content_block_delta',
  index,
  delta: { type: 'input_json_delta', partial_json: partial }
})

const blockStop = (index: number): StreamEvent => ({ type: 'content_block_stop', index })

describe('transformStreamEvent', () => {
  it('maps a text block through start, content, and end', () => {
    const blocks = new Map<number, OpenBlock>()

    expect(transformStreamEvent(textStart(0), blocks)).toStrictEqual({
      type: EventType.TEXT_MESSAGE_START,
      messageId: 'block-0',
      role: 'assistant'
    })
    expect(transformStreamEvent(textDelta(0, 'hi'), blocks)).toStrictEqual({
      type: EventType.TEXT_MESSAGE_CONTENT,
      messageId: 'block-0',
      delta: 'hi'
    })
    expect(transformStreamEvent(blockStop(0), blocks)).toStrictEqual({
      type: EventType.TEXT_MESSAGE_END,
      messageId: 'block-0'
    })
  })

  it('maps a tool_use block through start, args, and end', () => {
    const blocks = new Map<number, OpenBlock>()

    expect(
      transformStreamEvent(toolStart(1, { id: 'call-1', name: 'getRanges' }), blocks)
    ).toStrictEqual({
      type: EventType.TOOL_CALL_START,
      toolCallId: 'call-1',
      toolCallName: 'getRanges'
    })
    expect(transformStreamEvent(jsonDelta(1, '{"a":1}'), blocks)).toStrictEqual({
      type: EventType.TOOL_CALL_ARGS,
      toolCallId: 'call-1',
      delta: '{"a":1}'
    })
    expect(transformStreamEvent(blockStop(1), blocks)).toStrictEqual({
      type: EventType.TOOL_CALL_END,
      toolCallId: 'call-1'
    })
  })

  it('returns null for a delta whose index was never opened', () => {
    const blocks = new Map<number, OpenBlock>()
    expect(transformStreamEvent(textDelta(5, 'orphan'), blocks)).toBeNull()
  })
})
