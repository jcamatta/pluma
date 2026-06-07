// Registers one frontend tool (spec + handler) into the tools registry for the lifetime of the
// calling component: register on mount, unregister on unmount. The CopilotKit-style entry point —
// a component that owns some context (e.g. the editor) contributes the tools that act on it. Passive:
// it never calls the agent or touches window.api. Registration is keyed by the tool name; the latest
// spec/handler are kept in a ref (updated in an effect) so an inline entry object does not churn the
// registration effect.

import { useEffect, useRef } from 'react'
import { useToolRegistry, type ToolEntry, type ToolHandler } from './AgentToolsContext'

export function useFrontendTool(entry: ToolEntry): void {
  const registry = useToolRegistry()
  const name = entry.spec.name
  const latest = useRef(entry)

  useEffect(() => {
    latest.current = entry
  })

  useEffect(() => {
    const handler: ToolHandler = (args) => latest.current.handler(args)
    registry.register({ spec: latest.current.spec, handler })
    return () => registry.unregister(name)
  }, [registry, name])
}
