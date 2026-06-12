// Tests for the list-threads IPC handler. The SDK module is mocked so no real session store is touched:
// verify it serializes the use-case outcome into a plain Result — ok:true with the mapped summaries on
// success, ok:false with the ThreadReadFailed tag when the SDK rejects.

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  listSessions: vi.fn(),
  getSessionMessages: vi.fn()
}))

import { listSessions } from '@anthropic-ai/claude-agent-sdk'
import { handleListThreads } from '../list-threads-handler'

const listSessionsMock = vi.mocked(listSessions)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('handleListThreads', () => {
  it('returns ok:true with the mapped summaries', async () => {
    listSessionsMock.mockResolvedValue([
      { sessionId: 's1', summary: '', lastModified: 5, customTitle: 'Trip' }
    ])
    const result = await handleListThreads('/work')

    expect(result).toStrictEqual({
      ok: true,
      value: [{ id: 's1', title: 'Trip', updatedAt: 5 }]
    })
  })

  it('returns ok:false with ThreadReadFailed when the SDK rejects', async () => {
    listSessionsMock.mockRejectedValue(new Error('disk gone'))
    const result = await handleListThreads('/work')

    expect(result).toStrictEqual({ ok: false, error: { _tag: 'ThreadReadFailed' } })
  })
})
