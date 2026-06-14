// Data: the agent's context-occupancy figure as the application layer models it. `usedTokens` is the
// input footprint of the most recent model request (input + cache-read + cache-creation) over the
// model's `windowTokens`; `breakdown` keeps the three input components. A plain record with no behavior.
// The adapter produces it (live, as a STATE_SNAPSHOT payload; on resume, as a query result) and the IPC
// layer maps it to the matching wire type when it crosses to the renderer.

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
