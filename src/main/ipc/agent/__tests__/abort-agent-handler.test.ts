// Tests the abort IPC ack: aborting an unknown run is a no-op that still resolves ok, and runIpcAck logs
// the agent:abort channel with the started/succeeded lifecycle. The SDK is mocked so no real run store is
// touched, and the JSON logger writes to console.log, which we capture.

import { describe, expect, it, vi } from 'vitest'

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  listSessions: vi.fn(),
  getSessionMessages: vi.fn()
}))

import { handleAbortAgent } from '../abort-agent-handler'

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

describe('handleAbortAgent', () => {
  it('returns ok for an unknown run and logs the agent:abort lifecycle', () =>
    withCapturedLogs(async (logs) => {
      const result = await handleAbortAgent('unknown-run')
      const text = logs.join('\n')

      expect(result).toStrictEqual({ ok: true, value: null })
      expect(text).toContain('agent:abort')
      expect(text).toContain('started')
      expect(text).toContain('succeeded')
    }))
})
