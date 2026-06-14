// Provides the single Agent instance to the subtree and injects the registered frontend tools into
// it. Builds the api-bound Agent once (kept in a ref) with the tools registry's snapshot as its tool
// supplier, so a bare agent.runAgent() carries the currently registered tools. Also runs useToolBridge
// so a tool the model calls reaches the live registry and its result returns inside the same run. Must
// sit inside an AgentToolsProvider (it reads the registry). Tests bypass this and supply a fake agent
// via AgentContext directly.

import { useEffect, useState, type ReactNode } from 'react'
import { AgentContext } from './AgentContext'
import { ThreadControlsContext, type ThreadControls } from './ThreadControlsContext'
import { useToolRegistry } from './AgentToolsContext'
import { createApiAgent } from './adapters/create-api-agent'
import { useToolBridge } from './useToolBridge'

interface AgentProviderProps {
  readonly cwd: string
  readonly children: ReactNode
}

export function AgentProvider({ cwd, children }: AgentProviderProps): React.JSX.Element {
  const registry = useToolRegistry()
  const [agent] = useState(() => createApiAgent(() => registry.snapshot()))
  // Bind the controls to the agent so consumers may destructure seedThread/newThread without losing
  // the `this` that the Agent methods rely on. Held in state so the context value stays stable.
  const [controls] = useState<ThreadControls>(() => ({
    seedThread: (id, messages) => agent.seedThread(id, messages),
    newThread: () => agent.newThread(),
    currentThreadId: () => agent.currentThreadId(),
    seedContext: (usage) => agent.seedContextUsage(usage)
  }))

  useEffect(() => {
    agent.setCwd(cwd)
  }, [agent, cwd])

  useToolBridge(registry)

  return (
    <AgentContext.Provider value={agent}>
      <ThreadControlsContext.Provider value={controls}>{children}</ThreadControlsContext.Provider>
    </AgentContext.Provider>
  )
}
