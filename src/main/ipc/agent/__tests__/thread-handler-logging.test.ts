// Verifies the agent thread handlers emit observability through runIpc: each logs its own channel and
// the started/succeeded lifecycle on success, and started/failed on a typed failure. The SDK is mocked
// (as in the other agent handler tests) and the JSON logger writes to console.log, which we capture.
// This guards the per-handler channel wiring, which the Result-shape tests cannot see.

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  listSessions: vi.fn(),
  getSessionMessages: vi.fn()
}))

import { listSessions } from '@anthropic-ai/claude-agent-sdk'
import { handleListThreads } from '../list-threads-handler'

const listSessionsMock = vi.mocked(listSessions)

const withCapturedLogs = async (
  body: (logs: readonly string[]) => Promise<void>
): Promise<void> => {
  const logs: string[] = []
  const spy = vi.spyOn(console, 'log').mockImplementation((...args) => {
    logs.push(args.map((arg) => String(arg)).join(' '))
  })
  try {
    await body(logs)
  } finally {
    spy.mockRestore()
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('agent thread handler logging', () => {
  it('logs agent:list-threads with started and succeeded on success', () =>
    withCapturedLogs(async (logs) => {
      listSessionsMock.mockResolvedValue([])
      await handleListThreads('/work')
      const text = logs.join('\n')

      expect(text).toContain('agent:list-threads')
      expect(text).toContain('started')
      expect(text).toContain('succeeded')
    }))

  it('logs agent:list-threads with failed when the SDK rejects', () =>
    withCapturedLogs(async (logs) => {
      listSessionsMock.mockRejectedValue(new Error('disk gone'))
      await handleListThreads('/work')
      const text = logs.join('\n')

      expect(text).toContain('agent:list-threads')
      expect(text).toContain('failed')
    }))
})
