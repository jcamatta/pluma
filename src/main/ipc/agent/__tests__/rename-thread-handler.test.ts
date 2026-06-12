// Tests for the rename-thread IPC handler. The SDK module is mocked so no real session store is
// touched: verify it maps the wire request to the use case and serializes the outcome — ok:true with a
// null ack on success, ok:false with the ThreadWriteFailed tag when the SDK rejects.

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  renameSession: vi.fn(),
  deleteSession: vi.fn()
}))

import { renameSession } from '@anthropic-ai/claude-agent-sdk'
import { handleRenameThread } from '../rename-thread-handler'

const renameSessionMock = vi.mocked(renameSession)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('handleRenameThread', () => {
  it('renames via the SDK and returns ok:true', async () => {
    renameSessionMock.mockResolvedValue(undefined)
    const result = await handleRenameThread({ cwd: '/work', threadId: 's1', title: 'New' })

    expect(renameSessionMock).toHaveBeenCalledWith('s1', 'New', { dir: '/work' })
    expect(result).toStrictEqual({ ok: true, value: null })
  })

  it('returns ok:false with ThreadWriteFailed when the SDK rejects', async () => {
    renameSessionMock.mockRejectedValue(new Error('locked'))
    const result = await handleRenameThread({ cwd: '/work', threadId: 's1', title: 'New' })

    expect(result).toStrictEqual({ ok: false, error: { _tag: 'ThreadWriteFailed' } })
  })
})
