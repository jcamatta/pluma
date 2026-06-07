// Provides the frontend-tool registry to the subtree. The registry value is built by
// useCreateToolRegistry; this component only wires it into context so useFrontendTool (write) and
// useToolRegistry (read) share one instance.

import type { ReactNode } from 'react'
import { AgentToolsContext, useCreateToolRegistry } from './AgentToolsContext'

export function AgentToolsProvider({
  children
}: {
  readonly children: ReactNode
}): React.JSX.Element {
  const registry = useCreateToolRegistry()
  return <AgentToolsContext.Provider value={registry}>{children}</AgentToolsContext.Provider>
}
