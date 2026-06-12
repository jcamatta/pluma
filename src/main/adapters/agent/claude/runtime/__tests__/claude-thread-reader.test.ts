// Seam tests for the Claude ThreadReader adapter. The SDK module is mocked so no real session store is
// touched: verify listThreads passes the workspace dir, maps + sorts rows most-recent first, and that a
// rejected SDK call surfaces as a ThreadReadFailed; verify getThreadHistory maps the message chain.

import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  listSessions: vi.fn(),
  getSessionMessages: vi.fn()
}))

import { getSessionMessages, listSessions } from '@anthropic-ai/claude-agent-sdk'
import { ThreadReadFailed } from '../../../../../application/agent/error/thread-read-failed'
import { ThreadReader } from '../../../../../application/agent/port/thread-reader.port'
import { ClaudeThreadReaderLive } from '../claude-thread-reader'

const listSessionsMock = vi.mocked(listSessions)
const getSessionMessagesMock = vi.mocked(getSessionMessages)

const runList = (cwd: string): Promise<Exit.Exit<readonly unknown[], ThreadReadFailed>> =>
  Effect.runPromiseExit(
    Effect.provide(
      Effect.gen(function* () {
        const reader = yield* ThreadReader
        return yield* reader.listThreads(cwd)
      }),
      ClaudeThreadReaderLive
    )
  )

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ClaudeThreadReaderLive', () => {
  it('passes the dir and returns summaries most-recent first', async () => {
    listSessionsMock.mockResolvedValue([
      { sessionId: 'old', summary: '', lastModified: 1, firstPrompt: 'a' },
      { sessionId: 'new', summary: '', lastModified: 2, customTitle: 'Newest' }
    ])
    const exit = await runList('/work')
    expect(listSessionsMock).toHaveBeenCalledWith({ dir: '/work' })
    expect(exit).toStrictEqual(
      Exit.succeed([
        { id: 'new', title: 'Newest', updatedAt: 2 },
        { id: 'old', title: 'a', updatedAt: 1 }
      ])
    )
  })

  it('surfaces a ThreadReadFailed when the SDK rejects', async () => {
    listSessionsMock.mockRejectedValue(new Error('disk gone'))
    const exit = await runList('/work')
    expect(Exit.isFailure(exit)).toBe(true)
  })

  it('maps the message chain for getThreadHistory', async () => {
    getSessionMessagesMock.mockResolvedValue([
      {
        type: 'user',
        uuid: 'u1',
        session_id: 's',
        message: { role: 'user', content: 'hi' },
        parent_tool_use_id: null
      }
    ])
    const exit = await Effect.runPromiseExit(
      Effect.provide(
        Effect.gen(function* () {
          const reader = yield* ThreadReader
          return yield* reader.getThreadHistory('/work', 's1')
        }),
        ClaudeThreadReaderLive
      )
    )
    expect(getSessionMessagesMock).toHaveBeenCalledWith('s1', { dir: '/work' })
    expect(exit).toStrictEqual(Exit.succeed([{ id: 'u1', role: 'user', content: 'hi' }]))
  })
})
