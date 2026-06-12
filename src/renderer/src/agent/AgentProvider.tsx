// Provides the single Agent instance to the subtree and injects the registered frontend tools into
// it. Builds the api-bound Agent once (kept in a ref) with the tools registry's snapshot as its tool
// supplier, so a bare agent.runAgent() carries the currently registered tools. Also runs useToolBridge
// so a tool the model calls reaches the live registry and its result returns inside the same run. Must
// sit inside an AgentToolsProvider (it reads the registry). Tests bypass this and supply a fake agent
// via AgentContext directly.

import { useEffect, useState, type ReactNode } from 'react'
import { AgentContext } from './AgentContext'
import { ThreadControlsContext } from './ThreadControlsContext'
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

  useEffect(() => {
    agent.setCwd(cwd)
  }, [agent, cwd])

  useToolBridge(registry)

  return (
    <AgentContext.Provider value={agent}>
      <ThreadControlsContext.Provider value={agent}>{children}</ThreadControlsContext.Provider>
    </AgentContext.Provider>
  )
}
