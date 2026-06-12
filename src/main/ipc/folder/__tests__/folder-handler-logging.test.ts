// Verifies the folder handlers emit observability through runIpc: each logs its own channel and the
// started/succeeded lifecycle on success, and started/failed on a typed failure. The JSON logger writes
// to console.log, so we capture that. This guards the per-handler channel wiring, which the Result-shape
// tests cannot see.

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { handleCreateFolder } from '../create-folder-handler'
import { handleListFolder } from '../list-folder-handler'

interface Capture {
  readonly dir: string
  readonly logs: readonly string[]
}

const withCapture = async (body: (capture: Capture) => Promise<void>): Promise<void> => {
  const dir = mkdtempSync(join(tmpdir(), 'pluma-folder-log-'))
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

describe('folder handler logging', () => {
  it('logs folder:create with started and succeeded on success', () =>
    withCapture(async ({ dir, logs }) => {
      await handleCreateFolder(join(dir, 'chapters'))
      const text = logs.join('\n')

      expect(text).toContain('folder:create')
      expect(text).toContain('started')
      expect(text).toContain('succeeded')
    }))

  it('logs folder:list with failed on a typed failure', () =>
    withCapture(async ({ dir, logs }) => {
      await handleListFolder(join(dir, 'missing'))
      const text = logs.join('\n')

      expect(text).toContain('folder:list')
      expect(text).toContain('failed')
    }))
})
