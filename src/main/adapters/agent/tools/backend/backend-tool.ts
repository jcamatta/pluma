import type { Tool } from '@ag-ui/core'
import type * as Effect from 'effect/Effect'
import type { AgentToolResult } from '../../../../application/agent/data/agent-tool'

interface BackendTool {
  readonly spec: Tool
  readonly run: (args: unknown) => Effect.Effect<AgentToolResult>
}

export type { BackendTool }
