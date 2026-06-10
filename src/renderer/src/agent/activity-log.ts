// The activity model the rail renders, and the pure fold that builds it from a run's AG-UI events.
// The Agent keeps the settled conversation (agent.messages) but discards the transient timeline — the
// ordered steps and live status a run streams. This reducer captures exactly that: fold each BaseEvent
// into an AgentActivity. Kept pure (no React, no window.api) so it is fully unit-testable; the hook
// that subscribes and re-renders is a thin shell over it (see useAgentActivityLog).
//
// Per-step display text is not hardcoded here — the reducer is handed a `labels` bundle so copy stays
// i18n'd in the view layer. The reducer folds the AGUIEvent discriminated union, so each branch narrows
// by `event.type` with no cast (the hook narrows the agent's BaseEvent to AGUIEvent at the boundary).

import {
  EventType,
  type AGUIEvent,
  type RunErrorEvent,
  type TextMessageContentEvent,
  type ToolCallResultEvent,
  type ToolCallStartEvent
} from '@ag-ui/core'

type LogStatus = 'calling' | 'success' | 'failed' | 'thinking' | 'info'

interface LogEntry {
  readonly id: string
  readonly status: LogStatus
  readonly text: string
  readonly meta?: string
  // The tool name for a tool-call entry, kept so the result can re-label it (calling → done) without
  // re-parsing `text`. Absent for non-tool entries (run errors).
  readonly toolName?: string
}

type RunStatus = 'idle' | 'working' | 'done' | 'error'

interface AgentActivity {
  readonly status: RunStatus
  readonly startedAt: number
  readonly log: readonly LogEntry[]
  readonly summary: string
}

// The copy the reducer needs, injected so no strings live in this pure module. `calling`/`done` take
// the tool name; `runError` takes the run's error message.
interface ActivityLabels {
  readonly calling: (toolName: string) => string
  readonly done: (toolName: string) => string
  readonly runError: (message: string) => string
}

const initialActivity: AgentActivity = { status: 'idle', startedAt: 0, log: [], summary: '' }

type ActivityReducer = (state: AgentActivity, event: AGUIEvent) => AgentActivity

// Build the fold for a given copy bundle. Labels are bound once here (closure) rather than threaded
// through every step, which keeps each reducer function to two params and the returned reducer to the
// `(state, event)` shape useReducer expects. The reducer is pure: same events in, same activity out.
function createActivityReducer(labels: ActivityLabels): ActivityReducer {
  // A tool call's entry is keyed by its toolCallId so the matching result can flip it from calling →
  // success. An unknown id is ignored (the list is returned unchanged) — never throws.
  const settleToolCall = (
    log: readonly LogEntry[],
    event: ToolCallResultEvent
  ): readonly LogEntry[] =>
    log.map((entry) =>
      entry.id === event.toolCallId
        ? {
            ...entry,
            status: 'success',
            text: labels.done(entry.toolName ?? entry.text),
            meta: event.content || undefined
          }
        : entry
    )

  const onToolCallStart = (state: AgentActivity, event: ToolCallStartEvent): AgentActivity => ({
    ...state,
    log: [
      ...state.log,
      {
        id: event.toolCallId,
        status: 'calling',
        text: labels.calling(event.toolCallName),
        toolName: event.toolCallName
      }
    ]
  })

  const onTextContent = (state: AgentActivity, event: TextMessageContentEvent): AgentActivity => ({
    ...state,
    summary: state.summary + event.delta
  })

  const onRunError = (state: AgentActivity, event: RunErrorEvent): AgentActivity => ({
    ...state,
    status: 'error',
    log: [
      ...state.log,
      { id: `error-${state.log.length}`, status: 'failed', text: labels.runError(event.message) }
    ]
  })

  // RUN_STARTED begins a fresh turn; the tool/text events accrete the timeline and reply;
  // RUN_FINISHED/RUN_ERROR settle the status. Unhandled event types pass through unchanged — the rail
  // only needs this subset.
  return (state, event) => {
    if (event.type === EventType.RUN_STARTED) {
      return { status: 'working', startedAt: Date.now(), log: [], summary: '' }
    }
    if (event.type === EventType.TOOL_CALL_START) return onToolCallStart(state, event)
    if (event.type === EventType.TOOL_CALL_RESULT) {
      return { ...state, log: settleToolCall(state.log, event) }
    }
    if (event.type === EventType.TEXT_MESSAGE_CONTENT) return onTextContent(state, event)
    if (event.type === EventType.RUN_FINISHED) return { ...state, status: 'done' }
    if (event.type === EventType.RUN_ERROR) return onRunError(state, event)
    return state
  }
}

export { createActivityReducer, initialActivity }
export type { ActivityReducer, AgentActivity, LogEntry, LogStatus, RunStatus, ActivityLabels }
