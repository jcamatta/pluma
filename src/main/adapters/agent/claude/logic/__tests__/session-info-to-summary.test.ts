// Tests for sessionInfoToSummary: the calculation mapping an SDK session row to a ThreadSummary.
// Verifies the id and last-modified time pass through, the stored custom title wins, and the title
// falls back to the one derived from the first prompt when no custom title is set.

import { describe, expect, it } from 'vitest'
import type { SDKSessionInfo } from '@anthropic-ai/claude-agent-sdk'
import { sessionInfoToSummary } from '../session-info-to-summary'

const base: SDKSessionInfo = { sessionId: 's1', summary: 'ignored', lastModified: 1234 }

describe('sessionInfoToSummary', () => {
  it('prefers the stored custom title', () => {
    const summary = sessionInfoToSummary({
      ...base,
      customTitle: 'My thread',
      firstPrompt: 'hello'
    })
    expect(summary).toStrictEqual({ id: 's1', title: 'My thread', updatedAt: 1234 })
  })

  it('derives the title from the first prompt when no custom title is set', () => {
    const summary = sessionInfoToSummary({ ...base, firstPrompt: '  Plan the   trip ' })
    expect(summary).toStrictEqual({ id: 's1', title: 'Plan the trip', updatedAt: 1234 })
  })

  it('yields an empty title when neither is available', () => {
    expect(sessionInfoToSummary(base).title).toBe('')
  })
})
