// Keeps the threads list fresh after a run: subscribes to the agent's run-finalized signal and
// invalidates the workspace's ['threads', cwd] query, so a brand-new thread (or an updated last-activity)
// appears the next time the list is read. The agent owns the run lifecycle; this is the rail's observer
// of it. Re-subscribes if the agent or workspace changes.

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { AbstractAgent } from '@ag-ui/client'
import { threadsKey } from '../threads/threadKeys'

function useThreadsRefresh(agent: AbstractAgent, cwd: string): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    const { unsubscribe } = agent.subscribe({
      onRunFinalized: () => {
        void queryClient.invalidateQueries({ queryKey: threadsKey(cwd) })
      }
    })
    return () => unsubscribe()
  }, [agent, cwd, queryClient])
}

export { useThreadsRefresh }
