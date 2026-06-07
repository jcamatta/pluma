// Provides the single Agent instance to the subtree and injects the registered frontend tools into
// it. Builds the api-bound Agent once (kept in a ref) with the tools registry's snapshot as its tool
// supplier, so a bare agent.runAgent() carries the currently registered tools. Must sit inside an
// AgentToolsProvider (it reads the registry). Tests bypass this and supply a fake agent via
// AgentContext directly.

import { useState, type ReactNode } from 'react'
import { AgentContext } from './AgentContext'
import { useToolRegistry } from './AgentToolsContext'
import { createApiAgent } from './adapters/create-api-agent'

export function AgentProvider({ children }: { readonly children: ReactNode }): React.JSX.Element {
  const registry = useToolRegistry()
  const [agent] = useState(() => createApiAgent(() => registry.snapshot()))

  return <AgentContext.Provider value={agent}>{children}</AgentContext.Provider>
}
