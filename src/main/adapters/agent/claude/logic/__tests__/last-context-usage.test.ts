// Tests for lastContextUsageFromSession: takes the most recent assistant turn's usage and its model's
// window, ignores user/system turns and assistant turns without usage, and returns null when none apply.

import { describe, expect, it } from 'vitest'
import type { SessionMessage } from '@anthropic-ai/claude-agent-sdk'
import { lastContextUsageFromSession } from '../last-context-usage'

const entry = (type: SessionMessage['type'], message: unknown): SessionMessage => ({
  type,
  message,
  uuid: 'u',
  session_id: 'sess',
  parent_tool_use_id: null
})

const assistant = (model: string, tokens: { input: number; cacheRead: number }): SessionMessage =>
  entry('assistant', {
    model,
    usage: { input_tokens: tokens.input, cache_read_input_tokens: tokens.cacheRead }
  })

describe('lastContextUsageFromSession', () => {
  it('uses the most recent assistant usage and its model window', () => {
    const usage = lastContextUsageFromSession([
      assistant('claude-opus-4-8', { input: 100, cacheRead: 0 }),
      entry('user', { role: 'user', content: 'hi' }),
      assistant('claude-opus-4-8', { input: 5000, cacheRead: 55_000 })
    ])

    expect(usage).toEqual({
      usedTokens: 60_000,
      windowTokens: 1_000_000,
      breakdown: { inputTokens: 5000, cacheReadTokens: 55_000, cacheCreationTokens: 0 }
    })
  })

  it('falls back to the 200k window for an unknown model', () => {
    const usage = lastContextUsageFromSession([
      assistant('mystery-model', { input: 1000, cacheRead: 0 })
    ])
    expect(usage?.windowTokens).toBe(200_000)
  })

  it('returns null when there is no assistant turn carrying usage', () => {
    expect(lastContextUsageFromSession([])).toBeNull()
    expect(lastContextUsageFromSession([entry('user', { content: 'hi' })])).toBeNull()
    expect(lastContextUsageFromSession([entry('assistant', { model: 'x' })])).toBeNull()
  })
})
