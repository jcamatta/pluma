// Tests for the delete-thread IPC handler. The SDK module is mocked so no real session store is
// touched: verify it maps the wire request to the use case and serializes the outcome — ok:true with a
// null ack on success, ok:false with the ThreadWriteFailed tag when the SDK rejects.

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  renameSession: vi.fn(),
  deleteSession: vi.fn()
}))

import { deleteSession } from '@anthropic-ai/claude-agent-sdk'
import { handleDeleteThread } from '../delete-thread-handler'

const deleteSessionMock = vi.mocked(deleteSession)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('handleDeleteThread', () => {
  it('deletes via the SDK and returns ok:true', async () => {
    deleteSessionMock.mockResolvedValue(undefined)
    const result = await handleDeleteThread({ cwd: '/work', threadId: 's1' })

    expect(deleteSessionMock).toHaveBeenCalledWith('s1', { dir: '/work' })
    expect(result).toStrictEqual({ ok: true, value: null })
  })

  it('returns ok:false with ThreadWriteFailed when the SDK rejects', async () => {
    deleteSessionMock.mockRejectedValue(new Error('locked'))
    const result = await handleDeleteThread({ cwd: '/work', threadId: 's1' })

    expect(result).toStrictEqual({ ok: false, error: { _tag: 'ThreadWriteFailed' } })
  })
})
