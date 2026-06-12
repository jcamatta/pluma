// Verifies the file handlers emit observability through runIpc: each logs its own channel and the
// started/succeeded lifecycle on success, and started/failed on a typed failure. The JSON logger writes
// to console.log, so we capture that. This guards the per-handler channel wiring, which the Result-shape
// tests cannot see.

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { handleCreateFile } from '../create-file-handler'
import { handleReadFile } from '../read-file-handler'

interface Capture {
  readonly dir: string
  readonly logs: readonly string[]
}

const withCapture = async (body: (capture: Capture) => Promise<void>): Promise<void> => {
  const dir = mkdtempSync(join(tmpdir(), 'pluma-ipc-log-'))
  const logs: string[] = []
  const spy = vi.spyOn(console, 'log').mockImplementation((...args) => {
    logs.push(args.map((arg) => String(arg)).join(' '))
  })
  try {
    await body({ dir, logs })
  } finally {
    spy.mockRestore()
    rmSync(dir, { recursive: true, force: true })
  }
}

describe('file handler logging', () => {
  it('logs file:create with started and succeeded on success', () =>
    withCapture(async ({ dir, logs }) => {
      await handleCreateFile(join(dir, 'note.md'))
      const text = logs.join('\n')

      expect(text).toContain('file:create')
      expect(text).toContain('started')
      expect(text).toContain('succeeded')
    }))

  it('logs file:create with failed on a typed failure', () =>
    withCapture(async ({ dir, logs }) => {
      await handleCreateFile(join(dir, 'note.txt'))
      const text = logs.join('\n')

      expect(text).toContain('file:create')
      expect(text).toContain('failed')
    }))

  it('logs the file:read channel', () =>
    withCapture(async ({ dir, logs }) => {
      await handleReadFile(join(dir, 'missing.md'))
      const text = logs.join('\n')

      expect(text).toContain('file:read')
    }))
})
