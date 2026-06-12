// The renderer's agent surface — returns { agent } plus the thread-lifecycle controls (selectThread /
// newThread). Callers use AbstractAgent's real methods (addMessage, runAgent, abortRun, subscribe) and
// read agent.messages / agent.isRunning; the controls let a threads panel resume a selected thread or
// start a fresh one. The hook re-renders the component when the agent's messages or run status change,
// by subscribing to the agent and bumping a render tick. Tools are injected by AgentProvider, not here.

import { useContext, useEffect, useReducer } from 'react'
import type { AbstractAgent } from '@ag-ui/client'
import { useAgentInstance } from './AgentContext'
import { ThreadControlsContext, type ThreadControls } from './ThreadControlsContext'

interface AgentSurface {
  readonly agent: AbstractAgent
  readonly selectThread: ThreadControls['seedThread']
  readonly newThread: ThreadControls['newThread']
}

export function useAgent(): AgentSurface {
  const agent = useAgentInstance()
  const controls = useContext(ThreadControlsContext)
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

  return { agent, selectThread: controls.seedThread, newThread: controls.newThread }
}

export type { AgentSurface }
