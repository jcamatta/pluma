// Tests for renameFileTool against a real temp dir and a fake bridge: an approval actually moves the file
// on disk and returns ok, a rejection returns 'declined' and leaves the filesystem unchanged, and a rename
// of a missing source surfaces FileNotFound.

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as Effect from 'effect/Effect'
import { describe, expect, it } from 'vitest'
import type { AgentToolResult } from '../../../../../application/agent/data/agent-tool'
import type { ToolBridge } from '../../tool-bridge'
import { renameFileTool } from '../rename-file-tool'

const bridgeAnswering = (answer: AgentToolResult): ToolBridge => ({
  callTool: () => Promise.resolve(answer),
  resolve: () => undefined,
  rejectAll: () => undefined
})

const approve = bridgeAnswering({ ok: true, output: { type: 'text', text: 'ignored' } })
const reject = bridgeAnswering({ ok: false, error: 'declined' })

const withTempDir = async (body: (dir: string) => Promise<void>): Promise<void> => {
  const dir = mkdtempSync(join(tmpdir(), 'pluma-'))
  try {
    await body(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe('renameFileTool', () => {
  it('exposes a rename_file spec', () => {
    expect(renameFileTool({ bridge: approve, runId: 'run-1' }).spec.name).toBe('rename_file')
  })

  it('moves the file on disk and returns ok when approved', () =>
    withTempDir(async (dir) => {
      const oldPath = join(dir, 'old.md')
      const newPath = join(dir, 'new.md')
      writeFileSync(oldPath, 'content')
      const tool = renameFileTool({ bridge: approve, runId: 'run-1' })

      const result = await Effect.runPromise(tool.run({ oldPath, newPath }))

      expect(result).toEqual({ ok: true, output: { type: 'text', text: newPath } })
      expect(existsSync(oldPath)).toBe(false)
      expect(readFileSync(newPath, 'utf8')).toBe('content')
    }))

  it('returns declined and leaves the filesystem unchanged when rejected', () =>
    withTempDir(async (dir) => {
      const oldPath = join(dir, 'old.md')
      const newPath = join(dir, 'new.md')
      writeFileSync(oldPath, 'content')
      const tool = renameFileTool({ bridge: reject, runId: 'run-1' })

      const result = await Effect.runPromise(tool.run({ oldPath, newPath }))

      expect(result).toEqual({ ok: false, error: 'declined' })
      expect(existsSync(oldPath)).toBe(true)
      expect(existsSync(newPath)).toBe(false)
    }))

  it('surfaces FileNotFound when renaming a missing source', () =>
    withTempDir(async (dir) => {
      const oldPath = join(dir, 'missing.md')
      const newPath = join(dir, 'new.md')
      const tool = renameFileTool({ bridge: approve, runId: 'run-1' })

      const result = await Effect.runPromise(tool.run({ oldPath, newPath }))

      expect(result).toEqual({ ok: false, error: 'FileNotFound' })
    }))

  it('reports invalid_args when a path is missing', async () => {
    const tool = renameFileTool({ bridge: approve, runId: 'run-1' })

    const result = await Effect.runPromise(tool.run({ oldPath: '/abs/old.md' }))

    expect(result).toEqual({ ok: false, error: 'invalid_args' })
  })
})
