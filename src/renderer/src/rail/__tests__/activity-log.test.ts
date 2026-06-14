// reduceActivity folds a run's AG-UI events into the rail's activity model. RUN_STARTED opens a fresh
// turn; tool start/result accrete and settle the timeline; text deltas build the reply; RUN_FINISHED /
// RUN_ERROR settle the status. Driven by canned events — no agent, no IPC.

import { describe, expect, it } from 'vitest'
import { EventType, type AGUIEvent, type BaseEvent } from '@ag-ui/core'
import {
  createActivityReducer,
  initialActivity,
  type ActivityLabels,
  type AgentActivity
} from '../activity-log'

const labels: ActivityLabels = {
  calling: (tool) => `Calling ${tool}`,
  done: (tool) => `${tool} done`,
  failed: (tool) => `${tool} failed`,
  runError: (message) => `Run failed: ${message}`
}

const reduce = createActivityReducer(labels)

// Events arrive as full AGUIEvents at runtime; the reducer only reads the few fields each branch needs,
// so the tests build terse literals and trust them as AGUIEvent at this boundary — the same `asserts`
// narrowing the hook records on the live stream (no cast). The base shape (a `type` field) always holds.
function asAguiEvent(literal: BaseEvent): asserts literal is AGUIEvent {
  void literal
}

const event = (literal: BaseEvent): AGUIEvent => {
  asAguiEvent(literal)
  return literal
}

const fold = (events: readonly BaseEvent[]): AgentActivity =>
  events.reduce((state, raw) => reduce(state, event(raw)), initialActivity)

describe('reduceActivity', () => {
  it('opens a working turn on RUN_STARTED', () => {
    const state = fold([{ type: EventType.RUN_STARTED }])
    expect(state.status).toBe('working')
    expect(state.log).toEqual([])
    expect(state.summary).toBe('')
  })

  it('records a tool call and settles it on its result', () => {
    const state = fold([
      { type: EventType.RUN_STARTED },
      { type: EventType.TOOL_CALL_START, toolCallId: 'tc-1', toolCallName: 'propose_edit' },
      { type: EventType.TOOL_CALL_RESULT, toolCallId: 'tc-1', content: 'proposed' }
    ])

    expect(state.log).toHaveLength(1)
    expect(state.log[0]).toMatchObject({
      id: 'tc-1',
      status: 'success',
      text: 'propose_edit done',
      meta: 'proposed'
    })
  })

  it('shows a calling entry before its result arrives', () => {
    const state = fold([
      { type: EventType.RUN_STARTED },
      { type: EventType.TOOL_CALL_START, toolCallId: 'tc-1', toolCallName: 'get_content' }
    ])
    expect(state.log[0]).toMatchObject({ status: 'calling', text: 'Calling get_content' })
  })

  it('ignores a result whose tool call id is unknown', () => {
    const state = fold([
      { type: EventType.RUN_STARTED },
      { type: EventType.TOOL_CALL_RESULT, toolCallId: 'ghost', content: 'x' }
    ])
    expect(state.log).toEqual([])
  })

  it('accumulates text deltas into the summary', () => {
    const state = fold([
      { type: EventType.RUN_STARTED },
      { type: EventType.TEXT_MESSAGE_CONTENT, messageId: 'm1', delta: 'Hello' },
      { type: EventType.TEXT_MESSAGE_CONTENT, messageId: 'm1', delta: ', world' }
    ])
    expect(state.summary).toBe('Hello, world')
  })

  it('marks the run done on RUN_FINISHED', () => {
    const state = fold([{ type: EventType.RUN_STARTED }, { type: EventType.RUN_FINISHED }])
    expect(state.status).toBe('done')
  })

  it('marks the run errored and logs a failed step on RUN_ERROR', () => {
    const state = fold([
      { type: EventType.RUN_STARTED },
      { type: EventType.RUN_ERROR, message: 'boom' }
    ])
    expect(state.status).toBe('error')
    expect(state.log[0]).toMatchObject({ status: 'failed', text: 'Run failed: boom' })
  })

  it('resets the log and summary when a new run starts', () => {
    const state = fold([
      { type: EventType.RUN_STARTED },
      { type: EventType.TEXT_MESSAGE_CONTENT, messageId: 'm1', delta: 'first' },
      { type: EventType.RUN_FINISHED },
      { type: EventType.RUN_STARTED }
    ])
    expect(state.summary).toBe('')
    expect(state.log).toEqual([])
    expect(state.status).toBe('working')
  })

  it('passes through event types it does not handle', () => {
    const before = fold([{ type: EventType.RUN_STARTED }])
    const after = reduce(before, event({ type: EventType.STEP_STARTED }))
    expect(after).toEqual(before)
  })
})

describe('reduceActivity tool outcomes', () => {
  it('settles a tool step as success when its result is ok:true', () => {
    const state = fold([
      { type: EventType.RUN_STARTED },
      { type: EventType.TOOL_CALL_START, toolCallId: 'tc-1', toolCallName: 'propose_edit' },
      {
        type: EventType.TOOL_CALL_RESULT,
        toolCallId: 'tc-1',
        content: '{"ok":true,"output":{"proposalId":"p_1"}}'
      }
    ])
    expect(state.log[0]).toMatchObject({ status: 'success', text: 'propose_edit done' })
  })

  it('settles a tool step as failed when its result is ok:false', () => {
    const state = fold([
      { type: EventType.RUN_STARTED },
      { type: EventType.TOOL_CALL_START, toolCallId: 'tc-1', toolCallName: 'get_ranges' },
      {
        type: EventType.TOOL_CALL_RESULT,
        toolCallId: 'tc-1',
        content: '{"ok":false,"error":"Maximum call stack size exceeded"}'
      }
    ])
    expect(state.log[0]).toMatchObject({
      status: 'failed',
      text: 'get_ranges failed',
      meta: '{"ok":false,"error":"Maximum call stack size exceeded"}'
    })
  })
})
