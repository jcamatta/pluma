// Tracks how the *current* run failed: the typed failure code of live state, set from the agent's
// onRunFailed callback and cleared (null) when the next run initializes. AG-UI adds no message to
// agent.messages on failure (apply() ignores RUN_ERROR), so this is the only signal that marks the
// in-flight turn as errored. It is live-only — a reloaded thread carries no stored error trace. Thin
// subscription shell; no derivation lives here.

import { useEffect, useState } from 'react'
import type { AbstractAgent } from '@ag-ui/client'
import type { AgentRunFailure } from '../../../shared/ipc/ipc-event-contract/agent-run-failure'
import { AgentRunError } from '../agent/agent-run-error'

// Only our own Error subclass carries a code; anything else (an IPC-level throw, a middleware error)
// is a failure we have no specific remedy for.
const failureOf = (error: unknown): AgentRunFailure =>
  error instanceof AgentRunError ? error.failure : 'generic'

export function useRunFailed(agent: AbstractAgent): AgentRunFailure | null {
  const [failure, setFailure] = useState<AgentRunFailure | null>(null)

  useEffect(() => {
    const { unsubscribe } = agent.subscribe({
      onRunInitialized: () => setFailure(null),
      onRunFailed: ({ error }) => setFailure(failureOf(error))
    })
    return () => unsubscribe()
  }, [agent])

  return failure
}
