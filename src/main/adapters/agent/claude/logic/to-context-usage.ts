// Calculation: turn a model request's token usage into the AgentContextUsage the meter renders. The
// occupancy a context meter shows is the input footprint of one request — input + cache-read +
// cache-creation — not its output, and not a sum across turns. The SDK reports cache fields as
// `number | null` (and they may be absent on partial/stored messages), so each component is coalesced to
// a non-negative number before summing. `windowTokens` is the denominator from contextWindowForModel.
// Pure: the same usage and window always yield the same figure.

import type { AgentContextUsage } from '../../../../application/agent/data/context-usage'

interface RawUsage {
  readonly input_tokens?: number | null
  readonly cache_read_input_tokens?: number | null
  readonly cache_creation_input_tokens?: number | null
}

const orZero = (value: number | null | undefined): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0

function toContextUsage(usage: RawUsage, windowTokens: number): AgentContextUsage {
  const inputTokens = orZero(usage.input_tokens)
  const cacheReadTokens = orZero(usage.cache_read_input_tokens)
  const cacheCreationTokens = orZero(usage.cache_creation_input_tokens)
  return {
    usedTokens: inputTokens + cacheReadTokens + cacheCreationTokens,
    windowTokens,
    breakdown: { inputTokens, cacheReadTokens, cacheCreationTokens }
  }
}

export { toContextUsage }
export type { RawUsage }
