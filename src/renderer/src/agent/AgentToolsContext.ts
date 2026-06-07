// The frontend-tool registry context and its consumer hook. The registry is the single seam where
// tools are contributed (useFrontendTool) and read (the agent's `tools` snapshot, the bridge's
// dispatch). Entries live in a ref-backed Map and are read imperatively, so register/unregister
// never re-render consumers. `useToolRegistry` is the read side; `createToolRegistry` builds the
// value the provider supplies. Names are unique — a duplicate registration overwrites (last wins).

import { createContext, useContext, useMemo, useRef } from 'react'
import type { Tool } from '@ag-ui/core'
import { invariant } from '../../../shared/invariant'
import type { AgentToolResult } from './tools/types'

type ToolHandler = (args: unknown) => AgentToolResult | Promise<AgentToolResult>

interface ToolEntry {
  readonly spec: Tool
  readonly handler: ToolHandler
}

interface ToolRegistry {
  readonly register: (entry: ToolEntry) => void
  readonly unregister: (name: string) => void
  readonly snapshot: () => readonly Tool[]
  readonly byName: (name: string) => ToolEntry | undefined
}

const AgentToolsContext = createContext<ToolRegistry | undefined>(undefined)

function useCreateToolRegistry(): ToolRegistry {
  const entries = useRef(new Map<string, ToolEntry>())

  return useMemo<ToolRegistry>(
    () => ({
      register: (entry) => {
        entries.current.set(entry.spec.name, entry)
      },
      unregister: (name) => {
        entries.current.delete(name)
      },
      snapshot: () => [...entries.current.values()].map((entry) => entry.spec),
      byName: (name) => entries.current.get(name)
    }),
    []
  )
}

function useToolRegistry(): ToolRegistry {
  const registry = useContext(AgentToolsContext)
  invariant(registry, 'useToolRegistry must be used within an AgentToolsProvider')
  return registry
}

export { AgentToolsContext, useCreateToolRegistry, useToolRegistry }
export type { ToolEntry, ToolHandler, ToolRegistry }
