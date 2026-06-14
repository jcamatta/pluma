// Tests for the thread-context IPC handler. The SDK module is mocked so no real session store is
// touched: verify it serializes the use-case outcome into a plain Result — ok:true with the derived
// usage on success, ok:false with the ThreadReadFailed tag when the SDK rejects.

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  listSessions: vi.fn(),
  getSessionMessages: vi.fn()
}))

import { getSessionMessages } from '@anthropic-ai/claude-agent-sdk'
import { handleThreadContext } from '../thread-context-handler'

const getSessionMessagesMock = vi.mocked(getSessionMessages)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('handleThreadContext', () => {
  it('returns ok:true with the derived context usage', async () => {
    getSessionMessagesMock.mockResolvedValue([
      {
        type: 'assistant',
        uuid: 'a1',
        session_id: 's',
        message: {
          model: 'claude-opus-4-8',
          usage: { input_tokens: 5000, cache_read_input_tokens: 55_000 }
        },
        parent_tool_use_id: null
      }
    ])
    const result = await handleThreadContext({ cwd: '/work', threadId: 's1' })

    expect(result).toStrictEqual({
      ok: true,
      value: {
        usedTokens: 60_000,
        windowTokens: 1_000_000,
        breakdown: { inputTokens: 5000, cacheReadTokens: 55_000, cacheCreationTokens: 0 }
      }
    })
  })

  it('returns ok:true with null when no assistant turn has usage', async () => {
    getSessionMessagesMock.mockResolvedValue([])
    const result = await handleThreadContext({ cwd: '/work', threadId: 's1' })

    expect(result).toStrictEqual({ ok: true, value: null })
  })

  it('returns ok:false with ThreadReadFailed when the SDK rejects', async () => {
    getSessionMessagesMock.mockRejectedValue(new Error('missing'))
    const result = await handleThreadContext({ cwd: '/work', threadId: 's1' })

    expect(result).toStrictEqual({ ok: false, error: { _tag: 'ThreadReadFailed' } })
  })
})
