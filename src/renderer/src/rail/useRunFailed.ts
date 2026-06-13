// Tracks whether the *current* run has failed: a single boolean of live state, set from the agent's
// onRunFailed callback and cleared when the next run initializes. AG-UI adds no message to agent.messages
// on failure (apply() ignores RUN_ERROR), so this is the only signal that marks the in-flight turn as
// errored. It is live-only — a reloaded thread carries no stored error trace. Thin subscription shell;
// no derivation lives here.

import { useEffect, useState } from 'react'
import type { AbstractAgent } from '@ag-ui/client'

export function useRunFailed(agent: AbstractAgent): boolean {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const { unsubscribe } = agent.subscribe({
      onRunInitialized: () => setFailed(false),
      onRunFailed: () => setFailed(true)
    })
    return () => unsubscribe()
  }, [agent])

  return failed
}
