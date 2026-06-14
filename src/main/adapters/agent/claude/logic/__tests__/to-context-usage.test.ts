// Tests for toContextUsage: occupancy is input + cache-read + cache-creation (output excluded), null and
// missing cache fields coalesce to zero, and the breakdown carries the three components.

import { describe, expect, it } from 'vitest'
import { toContextUsage } from '../to-context-usage'

describe('toContextUsage', () => {
  it('sums input and both cache components into the occupancy', () => {
    const usage = toContextUsage(
      {
        input_tokens: 1200,
        cache_read_input_tokens: 11_000,
        cache_creation_input_tokens: 200
      },
      1_000_000
    )
    expect(usage.usedTokens).toBe(12_400)
    expect(usage.windowTokens).toBe(1_000_000)
    expect(usage.breakdown).toEqual({
      inputTokens: 1200,
      cacheReadTokens: 11_000,
      cacheCreationTokens: 200
    })
  })

  it('coalesces null and missing cache fields to zero', () => {
    const usage = toContextUsage({ input_tokens: 500, cache_read_input_tokens: null }, 200_000)
    expect(usage.usedTokens).toBe(500)
    expect(usage.breakdown).toEqual({
      inputTokens: 500,
      cacheReadTokens: 0,
      cacheCreationTokens: 0
    })
  })

  it('clamps negative or non-finite components to zero', () => {
    const usage = toContextUsage(
      { input_tokens: -5, cache_read_input_tokens: Number.NaN, cache_creation_input_tokens: 10 },
      200_000
    )
    expect(usage.usedTokens).toBe(10)
  })
})
