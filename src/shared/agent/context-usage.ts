// Data: the agent's context-occupancy figure, carried on AG-UI's shared `agent.state` under a
// `contextUsage` key and (on the resume path) across IPC as a query result. `usedTokens` is the input
// footprint of the most recent model request (input + cache-read + cache-creation) measured against the
// model's `windowTokens`; `breakdown` keeps the three input components for the meter's popover. A plain
// record with no behavior — the backend produces it, the renderer reads it through a guard.

interface AgentContextBreakdown {
  readonly inputTokens: number
  readonly cacheReadTokens: number
  readonly cacheCreationTokens: number
}

interface AgentContextUsage {
  readonly usedTokens: number
  readonly windowTokens: number
  readonly breakdown: AgentContextBreakdown
}

export type { AgentContextUsage, AgentContextBreakdown }
