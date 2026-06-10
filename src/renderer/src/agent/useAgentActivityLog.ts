// The rail's live activity feed: subscribes to the agent's event stream and folds it into an
// AgentActivity (status + ordered log + reply summary) via the pure reducer. This is the transient
// timeline the Agent itself discards — the settled conversation stays on agent.messages. The hook is
// the thin React shell; all the logic lives in activity-log.ts. `labels` carries the i18n'd per-step
// copy. Folding happens inside the subscription callback (an effect, not render), so the latest-labels
// ref is read where ref reads are allowed; the agent is the only resubscribe trigger.

import { useEffect, useRef, useState } from 'react'
import type { AbstractAgent } from '@ag-ui/client'
import type { AGUIEvent, BaseEvent } from '@ag-ui/core'
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
    const { unsubscribe } = agent.subscribe({
      onEvent: ({ event }) => {
        asAguiEvent(event)
        current.current = reduce(current.current, event)
        setActivity(current.current)
      }
    })
    return () => unsubscribe()
  }, [agent])

  return activity
}
