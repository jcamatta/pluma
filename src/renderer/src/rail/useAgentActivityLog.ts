// The rail's live activity feed: subscribes to the agent and folds the run into an AgentActivity
// (status + ordered log + reply summary) via the pure reducer. This is the transient timeline the Agent
// itself discards — the settled conversation stays on agent.messages. The hook is the thin React shell;
// all the logic lives in activity-log.ts. `labels` carries the i18n'd per-step copy.
//
// The run's *content* (text deltas, tool start/result) arrives through the subscriber's onEvent. Its
// *lifecycle* does not: AG-UI's event pipeline consumes RUN_STARTED/RUN_FINISHED/RUN_ERROR internally and
// never re-emits them to onEvent — they surface as the onRunInitialized/onRunFinalized/onRunFailed
// callbacks instead. So we feed the reducer a synthetic RUN_STARTED/RUN_FINISHED/RUN_ERROR from those
// callbacks; the reducer (and its tests) stay unchanged. Folding happens inside the subscription (an
// effect, not render), so the latest-labels ref is read where ref reads are allowed.

import { useEffect, useRef, useState } from 'react'
import type { AbstractAgent } from '@ag-ui/client'
import { EventType, type AGUIEvent, type BaseEvent } from '@ag-ui/core'
import {
  createActivityReducer,
  initialActivity,
  type ActivityLabels,
  type AgentActivity
} from './activity-log'

// The agent's onEvent hands a BaseEvent; every event on the stream is a member of the AGUIEvent
// discriminated union (main produced it from the same @ag-ui/core schemas). This records that trust at
// the boundary with an `asserts` signature — the same no-cast narrowing tool as invariant/assertWire —
// so the reducer can switch on `event.type` without a cast. The base shape always holds: a `type` field.
function asAguiEvent(event: BaseEvent): asserts event is AGUIEvent {
  void event
}

export function useAgentActivityLog(agent: AbstractAgent, labels: ActivityLabels): AgentActivity {
  const [activity, setActivity] = useState<AgentActivity>(initialActivity)

  // Keep the current activity and the latest labels in refs so the subscription folds without being
  // torn down on every render or locale change.
  const current = useRef(initialActivity)
  const latestLabels = useRef(labels)
  useEffect(() => {
    latestLabels.current = labels
  })

  useEffect(() => {
    const reduce = createActivityReducer(latestLabels.current)
    const fold = (event: AGUIEvent): void => {
      current.current = reduce(current.current, event)
      setActivity(current.current)
    }
    // The reducer reads only the few fields each branch needs; the lifecycle callbacks don't carry the
    // run's threadId/runId, so the synthetic events stub them. ids are irrelevant to the fold.
    const { unsubscribe } = agent.subscribe({
      onRunInitialized: () => fold({ type: EventType.RUN_STARTED, threadId: '', runId: '' }),
      onEvent: ({ event }) => {
        asAguiEvent(event)
        fold(event)
      },
      // A failed run reports its error here, not as a RUN_ERROR onEvent; synthesize one so the reducer
      // logs the failed step and settles the status. onRunFinalized then fires for failures too — but the
      // reducer leaves an 'error' status untouched on RUN_FINISHED, so the failure is not overwritten.
      onRunFailed: ({ error }) =>
        fold({
          type: EventType.RUN_ERROR,
          message: error instanceof Error ? error.message : String(error)
        }),
      onRunFinalized: () => fold({ type: EventType.RUN_FINISHED, threadId: '', runId: '' })
    })
    return () => unsubscribe()
  }, [agent])

  return activity
}
