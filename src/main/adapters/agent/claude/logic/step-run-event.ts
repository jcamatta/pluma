// Calculation: fold one Claude SDK message into AG-UI events (@ag-ui/core), carrying run state in an
// accumulator. system/init opens the run (RUN_STARTED) and fixes the threadId; stream_event becomes
// text/tool deltas; a user message becomes tool results; result closes the run (RUN_FINISHED). threadId
// and the open-block map live in the accumulator, so the fold needs no shared mutation.

import { EventType, type BaseEvent } from '@ag-ui/core'
import type { SDKMessage, SDKResultMessage } from '@anthropic-ai/claude-agent-sdk'
import type { OpenBlock, StreamEvent } from '../data/sdk-types'
import { toolResultEvents } from './tool-result-events'
import { transformStreamEvent } from './transform-stream-event'

export interface RunAccumulator {
  readonly threadId: string
  readonly blocks: Map<number, OpenBlock>
  // The id of the assistant message currently streaming, taken from each `message_start`. Text message
  // ids are minted from it so two assistant messages in the same or successive runs — which both restart
  // their content-block index at 0 — never collide.
  readonly currentMessageId: string
}

const newRunAccumulator = (): RunAccumulator => ({
  threadId: '',
  blocks: new Map(),
  currentMessageId: ''
})

// A `message_start` opens a new assistant message: adopt its id so later text blocks key off it. Every
// other stream event maps through transformStreamEvent against the open-block map and current message id.
const onStreamEvent = (
  acc: RunAccumulator,
  inner: StreamEvent
): readonly [RunAccumulator, readonly BaseEvent[]] => {
  if (inner.type === 'message_start') {
    return [{ ...acc, currentMessageId: inner.message.id }, []]
  }
  const event = transformStreamEvent(inner, { blocks: acc.blocks, messageId: acc.currentMessageId })
  return [acc, event ? [event] : []]
}

// The closing event for a result message. A result can close the run as a failure (e.g. resuming a
// session the SDK never opened): the SDK sets `is_error` and reports the reason in `subtype`. Surface
// that as RUN_ERROR so the rail shows the failure instead of a misleading "Worked"; only a clean result
// finishes the run successfully.
const resultEvent = (
  message: SDKResultMessage,
  run: RunAccumulator & { runId: string }
): BaseEvent => {
  if (message.is_error) {
    const reason = message.subtype === 'success' ? 'agent run failed' : message.subtype
    return { type: EventType.RUN_ERROR, runId: run.runId, message: reason }
  }
  return {
    type: EventType.RUN_FINISHED,
    threadId: run.threadId,
    runId: run.runId,
    outcome: { type: 'success' }
  }
}

const stepRunEvent =
  (runId: string) =>
  (acc: RunAccumulator, message: SDKMessage): readonly [RunAccumulator, readonly BaseEvent[]] => {
    if (message.type === 'system' && message.subtype === 'init') {
      const threadId = message.session_id
      return [{ ...acc, threadId }, [{ type: EventType.RUN_STARTED, threadId, runId }]]
    }
    if (message.type === 'stream_event') return onStreamEvent(acc, message.event)
    if (message.type === 'user') return [acc, toolResultEvents(message.message.content)]
    if (message.type === 'result') return [acc, [resultEvent(message, { ...acc, runId })]]
    return [acc, []]
  }

export { newRunAccumulator, stepRunEvent }
