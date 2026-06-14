// Calculation: read the agent's context usage out of AG-UI's shared `agent.state`. Both paths that feed
// the meter (the live STATE_SNAPSHOT and the resume setState) put an AgentContextUsage under a
// `contextUsage` key; the state is `unknown` at this boundary, so this narrows it with a `value is T`
// guard (no cast), returning undefined for anything that is not a well-formed usage. Pure.

import type { AgentContextUsage, AgentContextBreakdown } from '../../../shared/agent/context-usage'

function numberField(source: object, key: string): number | undefined {
  const value = Reflect.get(source, key)
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
}

function readBreakdown(value: unknown): AgentContextBreakdown | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const inputTokens = numberField(value, 'inputTokens')
  const cacheReadTokens = numberField(value, 'cacheReadTokens')
  const cacheCreationTokens = numberField(value, 'cacheCreationTokens')
  if (
    inputTokens === undefined ||
    cacheReadTokens === undefined ||
    cacheCreationTokens === undefined
  ) {
    return undefined
  }
  return { inputTokens, cacheReadTokens, cacheCreationTokens }
}

function readAgentContextUsage(state: unknown): AgentContextUsage | undefined {
  if (typeof state !== 'object' || state === null) return undefined
  const usage = Reflect.get(state, 'contextUsage')
  if (typeof usage !== 'object' || usage === null) return undefined
  const usedTokens = numberField(usage, 'usedTokens')
  const windowTokens = numberField(usage, 'windowTokens')
  const breakdown = readBreakdown(Reflect.get(usage, 'breakdown'))
  if (usedTokens === undefined || windowTokens === undefined || breakdown === undefined) {
    return undefined
  }
  return { usedTokens, windowTokens, breakdown }
}

export { readAgentContextUsage }
