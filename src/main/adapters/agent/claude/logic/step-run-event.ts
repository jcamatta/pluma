// Calculation: fold one Claude SDK message into AG-UI events (@ag-ui/core), carrying run state in an
// accumulator. system/init opens the run (RUN_STARTED) and fixes the threadId; stream_event becomes
// text/tool deltas; a user message becomes tool results; result closes the run (RUN_FINISHED). threadId
// and the open-block map live in the accumulator, so the fold needs no shared mutation.

import { EventType, type BaseEvent } from '@ag-ui/core'
import type {
  SDKAssistantMessage,
  SDKMessage,
  SDKResultMessage
} from '@anthropic-ai/claude-agent-sdk'
import type { RunFailure } from '../../../../application/agent/data/run-failure'
import type { OpenBlock, StreamEvent } from '../data/sdk-types'
import { toContextUsage } from './to-context-usage'
import { toolResultEvents } from './tool-result-events'
import { toRunFailure } from './to-run-failure'
import { transformStreamEvent } from './transform-stream-event'

export interface RunAccumulator {
  readonly threadId: string
  readonly blocks: Map<number, OpenBlock>
  // The id of the assistant message currently streaming, taken from each `message_start`. Text message
  // ids are minted from it so two assistant messages in the same or successive runs — which both restart
  // their content-block index at 0 — never collide.
  readonly currentMessageId: string
  // The id of the assistant message whose usage was last published as a context snapshot. Parallel tool
  // calls emit several assistant messages sharing one id with identical usage; tracking the id lets the
  // fold skip the duplicates so the meter is not re-emitted for the same figure.
  readonly lastUsageMessageId: string
  // Why the run failed, as last reported by an assistant message. The SDK names the reason there and
  // not on the result message, so it has to be remembered until the result closes the run.
  readonly failure: RunFailure
}

// What the fold needs for the whole run: the runId stamped on every event, and the model's context
// window (the meter's denominator) used to turn each assistant message's usage into a snapshot.
interface StepDeps {
  readonly runId: string
  readonly contextWindow: number
}

const newRunAccumulator = (): RunAccumulator => ({
  threadId: '',
  blocks: new Map(),
  currentMessageId: '',
  lastUsageMessageId: '',
  failure: 'generic'
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
// finishes the run successfully. The recorded failure is what the UI branches on: an expired sign-in
// arrives as `is_error` with `subtype: 'success'`, so `subtype` alone cannot tell the reason.
const resultEvent = (
  message: SDKResultMessage,
  run: RunAccumulator & { runId: string }
): BaseEvent => {
  if (message.is_error) {
    const reason = message.subtype === 'success' ? 'agent run failed' : message.subtype
    return { type: EventType.RUN_ERROR, runId: run.runId, message: reason, code: run.failure }
  }
  return {
    type: EventType.RUN_FINISHED,
    threadId: run.threadId,
    runId: run.runId,
    outcome: { type: 'success' }
  }
}

// An assistant message carries the turn's final token usage. Publish it as a STATE_SNAPSHOT so the
// renderer's context meter reflects how full the window is, skipping the duplicate ids parallel tool
// calls produce. The snapshot replaces `agent.state` wholesale, which is fine: contextUsage is the only
// key we keep there.
//
// Any failure the message reports is recorded before the duplicate-id guard: that guard returns the
// accumulator untouched, and parallel tool calls reuse a message id, so recording after it would drop
// the reason for the failure that follows.
const onAssistant = (
  acc: RunAccumulator,
  input: { readonly message: SDKAssistantMessage; readonly contextWindow: number }
): readonly [RunAccumulator, readonly BaseEvent[]] => {
  const error = input.message.error
  const seen = error ? { ...acc, failure: toRunFailure(error) } : acc
  const id = input.message.message.id
  if (id === seen.lastUsageMessageId) return [seen, []]
  const contextUsage = toContextUsage(input.message.message.usage, input.contextWindow)
  return [
    { ...seen, lastUsageMessageId: id },
    [{ type: EventType.STATE_SNAPSHOT, snapshot: { contextUsage } }]
  ]
}

const stepRunEvent =
  (deps: StepDeps) =>
  (acc: RunAccumulator, message: SDKMessage): readonly [RunAccumulator, readonly BaseEvent[]] => {
    if (message.type === 'system' && message.subtype === 'init') {
      const threadId = message.session_id
      return [{ ...acc, threadId }, [{ type: EventType.RUN_STARTED, threadId, runId: deps.runId }]]
    }
    if (message.type === 'stream_event') return onStreamEvent(acc, message.event)
    if (message.type === 'assistant') {
      return onAssistant(acc, { message, contextWindow: deps.contextWindow })
    }
    if (message.type === 'user') return [acc, toolResultEvents(message.message.content)]
    if (message.type === 'result')
      return [acc, [resultEvent(message, { ...acc, runId: deps.runId })]]
    return [acc, []]
  }

export { newRunAccumulator, stepRunEvent }
