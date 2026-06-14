// Tests for readAgentContextUsage: the guard that lifts AgentContextUsage off agent.state. Accepts a
// well-formed shape and rejects non-objects, a missing contextUsage, and a partial breakdown.

import { describe, expect, it } from 'vitest'
import { readAgentContextUsage } from '../read-context-usage'

const wellFormed = {
  contextUsage: {
    usedTokens: 12_400,
    windowTokens: 1_000_000,
    breakdown: { inputTokens: 1200, cacheReadTokens: 11_000, cacheCreationTokens: 200 }
  }
}

describe('readAgentContextUsage', () => {
  it('reads a well-formed usage from state', () => {
    expect(readAgentContextUsage(wellFormed)).toEqual(wellFormed.contextUsage)
  })

  it('returns undefined for non-objects and an absent contextUsage', () => {
    expect(readAgentContextUsage(undefined)).toBeUndefined()
    expect(readAgentContextUsage(null)).toBeUndefined()
    expect(readAgentContextUsage({})).toBeUndefined()
    expect(readAgentContextUsage({ contextUsage: 5 })).toBeUndefined()
  })

  it('returns undefined when fields or the breakdown are incomplete', () => {
    expect(
      readAgentContextUsage({ contextUsage: { usedTokens: 10, windowTokens: 100 } })
    ).toBeUndefined()
    expect(
      readAgentContextUsage({
        contextUsage: {
          usedTokens: 10,
          windowTokens: 100,
          breakdown: { inputTokens: 10, cacheReadTokens: 0 }
        }
      })
    ).toBeUndefined()
  })
})
