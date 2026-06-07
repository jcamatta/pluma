// The renderer's agent surface — returns { agent }, exactly CopilotKit's interface. It adds no
// methods of its own: callers use AbstractAgent's real methods (addMessage, runAgent, abortRun,
// subscribe) and read agent.messages / agent.isRunning. The hook's only job is to re-render the
// component when the agent's messages or run status change, by subscribing to the agent and bumping
// a render tick. Tools are injected by AgentProvider, not here.

import { useEffect, useReducer } from 'react'
import type { AbstractAgent } from '@ag-ui/client'
import { useAgentInstance } from './AgentContext'

export function useAgent(): { agent: AbstractAgent } {
  const agent = useAgentInstance()
  const [, rerender] = useReducer((tick: number) => tick + 1, 0)

  useEffect(() => {
    const { unsubscribe } = agent.subscribe({
      onMessagesChanged: () => rerender(),
      onStateChanged: () => rerender(),
      onRunInitialized: () => rerender(),
      onRunFinalized: () => rerender(),
      onRunFailed: () => rerender()
    })
    return () => unsubscribe()
  }, [agent])

  return { agent }
}
