// Seam tests for the Claude ThreadWriter adapter. The SDK module is mocked so no real session store is
// touched: verify renameThread/deleteThread pass the session id, title, and workspace dir to the SDK,
// and that a rejected SDK call surfaces as a ThreadWriteFailed.

import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  renameSession: vi.fn(),
  deleteSession: vi.fn()
}))

import { deleteSession, renameSession } from '@anthropic-ai/claude-agent-sdk'
import {
  ThreadWriter,
  type ThreadWriterPort
} from '../../../../../application/agent/port/thread-writer.port'
import { ClaudeThreadWriterLive } from '../claude-thread-writer'

const renameSessionMock = vi.mocked(renameSession)
const deleteSessionMock = vi.mocked(deleteSession)

const run = (
  eff: Effect.Effect<void, unknown, ThreadWriterPort>
): Promise<Exit.Exit<void, unknown>> =>
  Effect.runPromiseExit(Effect.provide(eff, ClaudeThreadWriterLive))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ClaudeThreadWriterLive', () => {
  it('renames via the SDK with the id, title, and dir', async () => {
    renameSessionMock.mockResolvedValue(undefined)
    const exit = await run(
      Effect.gen(function* () {
        const writer = yield* ThreadWriter
        return yield* writer.renameThread({ cwd: '/work', id: 's1', title: 'Renamed' })
      })
    )
    expect(renameSessionMock).toHaveBeenCalledWith('s1', 'Renamed', { dir: '/work' })
    expect(Exit.isSuccess(exit)).toBe(true)
  })

  it('deletes via the SDK with the id and dir', async () => {
    deleteSessionMock.mockResolvedValue(undefined)
    const exit = await run(
      Effect.gen(function* () {
        const writer = yield* ThreadWriter
        return yield* writer.deleteThread('/work', 's1')
      })
    )
    expect(deleteSessionMock).toHaveBeenCalledWith('s1', { dir: '/work' })
    expect(Exit.isSuccess(exit)).toBe(true)
  })

  it('surfaces a ThreadWriteFailed when the SDK rejects', async () => {
    deleteSessionMock.mockRejectedValue(new Error('locked'))
    const exit = await run(
      Effect.gen(function* () {
        const writer = yield* ThreadWriter
        return yield* writer.deleteThread('/work', 's1')
      })
    )
    expect(Exit.isFailure(exit)).toBe(true)
  })
})
