// Calculation: map one Claude SDK stream event to an AG-UI event (@ag-ui/core), or null when the event
// carries nothing the renderer needs. The SDK reports content blocks as start/delta/stop events keyed
// only by a numeric index, and the delta/stop events do not say whether the block is text or a tool use.
// So we must remember, per index, what kind of block was opened at `start` to route its later deltas and
// stop — that is what the context's `blocks` map holds. Text blocks become TEXT_MESSAGE_*; tool_use
// blocks become TOOL_CALL_*. Text message ids are minted from the streaming assistant message's id
// (context.messageId) so two assistant messages — which both restart their block index at 0 — never
// collide; tool ids use the SDK's own globally-unique block id.

import { EventType, type BaseEvent } from '@ag-ui/core'
import type { StreamEvent, TransformContext } from '../data/sdk-types'

const onBlockStart = (event: StreamEvent, context: TransformContext): BaseEvent | null => {
  if (event.type !== 'content_block_start') return null
  const block = event.content_block
  if (block.type === 'text') {
    const messageId = `${context.messageId}-block-${event.index}`
    context.blocks.set(event.index, { kind: 'text', messageId })
    return { type: EventType.TEXT_MESSAGE_START, messageId, role: 'assistant' }
  }
  if (block.type === 'tool_use') {
    context.blocks.set(event.index, { kind: 'tool', toolCallId: block.id })
    return { type: EventType.TOOL_CALL_START, toolCallId: block.id, toolCallName: block.name }
  }
  return null
}

const onBlockDelta = (event: StreamEvent, context: TransformContext): BaseEvent | null => {
  if (event.type !== 'content_block_delta') return null
  const open = context.blocks.get(event.index)
  const delta = event.delta
  if (open?.kind === 'text' && delta.type === 'text_delta') {
    return { type: EventType.TEXT_MESSAGE_CONTENT, messageId: open.messageId, delta: delta.text }
  }
  if (open?.kind === 'tool' && delta.type === 'input_json_delta') {
    return {
      type: EventType.TOOL_CALL_ARGS,
      toolCallId: open.toolCallId,
      delta: delta.partial_json
    }
  }
  return null
}

const onBlockStop = (event: StreamEvent, context: TransformContext): BaseEvent | null => {
  if (event.type !== 'content_block_stop') return null
  const open = context.blocks.get(event.index)
  context.blocks.delete(event.index)
  if (open?.kind === 'text') return { type: EventType.TEXT_MESSAGE_END, messageId: open.messageId }
  if (open?.kind === 'tool') return { type: EventType.TOOL_CALL_END, toolCallId: open.toolCallId }
  return null
}

export const transformStreamEvent = (
  event: StreamEvent,
  context: TransformContext
): BaseEvent | null =>
  onBlockStart(event, context) ?? onBlockDelta(event, context) ?? onBlockStop(event, context)
