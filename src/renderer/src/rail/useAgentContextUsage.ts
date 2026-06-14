// The rail's context-usage feed: reads the AgentContextUsage the agent keeps on its AG-UI shared state
// and re-renders when it changes. The backend publishes it live as a STATE_SNAPSHOT during a run, and
// (on the resume path) it is seeded with setState; both land on agent.state, and AbstractAgent calls
// onStateChanged for each. The hook initializes from the current state so a thread reopened before this
// mounts still shows its figure, then subscribes for updates. Returns undefined when no usage is known
// (a fresh thread), which the composer renders as a hidden meter.

import { useEffect, useState } from 'react'
import type { AbstractAgent } from '@ag-ui/client'
import type { AgentContextUsage } from '../../../shared/agent/context-usage'
import { readAgentContextUsage } from './read-context-usage'

function useAgentContextUsage(agent: AbstractAgent): AgentContextUsage | undefined {
  const [usage, setUsage] = useState<AgentContextUsage | undefined>(() =>
    readAgentContextUsage(agent.state)
  )

  useEffect(() => {
    const { unsubscribe } = agent.subscribe({
      onStateChanged: ({ state }) => setUsage(readAgentContextUsage(state))
    })
    return () => unsubscribe()
  }, [agent])

  return usage
}

export { useAgentContextUsage }
