// Context carrying the single AbstractAgent instance for the subtree. The provider builds the real
// Agent (over window.api) and injects the registered tools; tests supply a fake AbstractAgent that
// emits scripted events. useAgentInstance is the low-level read; useAgent (separate file) wraps it
// with React subscription so components re-render on the agent's message/run-status changes.

import { createContext, useContext } from 'react'
import type { AbstractAgent } from '@ag-ui/client'
import { invariant } from '../../../shared/invariant'

const AgentContext = createContext<AbstractAgent | undefined>(undefined)

function useAgentInstance(): AbstractAgent {
  const agent = useContext(AgentContext)
  invariant(agent, 'useAgentInstance must be used within an AgentProvider')
  return agent
}

export { AgentContext, useAgentInstance }
