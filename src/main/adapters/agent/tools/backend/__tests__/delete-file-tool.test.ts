// Tests for deleteFileTool against a real temp dir and a fake bridge: an approval actually removes the file
// on disk and returns ok, a rejection returns 'declined' and leaves the filesystem unchanged, and a delete
// of a missing file surfaces FileNotFound.

import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as Effect from 'effect/Effect'
import { describe, expect, it } from 'vitest'
import type { AgentToolResult } from '../../../../../application/agent/data/agent-tool'
import type { ToolBridge } from '../../tool-bridge'
import { deleteFileTool } from '../delete-file-tool'

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

describe('deleteFileTool', () => {
  it('exposes a delete_file spec', () => {
    expect(deleteFileTool({ bridge: approve, runId: 'run-1' }).spec.name).toBe('delete_file')
  })

  it('removes the file on disk and returns ok when approved', () =>
    withTempDir(async (dir) => {
      const target = join(dir, 'note.md')
      writeFileSync(target, 'content')
      const tool = deleteFileTool({ bridge: approve, runId: 'run-1' })

      const result = await Effect.runPromise(tool.run({ path: target }))

      expect(result).toEqual({ ok: true, output: { type: 'text', text: target } })
      expect(existsSync(target)).toBe(false)
    }))

  it('returns declined and leaves the filesystem unchanged when rejected', () =>
    withTempDir(async (dir) => {
      const target = join(dir, 'note.md')
      writeFileSync(target, 'content')
      const tool = deleteFileTool({ bridge: reject, runId: 'run-1' })

      const result = await Effect.runPromise(tool.run({ path: target }))

      expect(result).toEqual({ ok: false, error: 'declined' })
      expect(existsSync(target)).toBe(true)
    }))

  it('surfaces FileNotFound when deleting a missing file', () =>
    withTempDir(async (dir) => {
      const target = join(dir, 'missing.md')
      const tool = deleteFileTool({ bridge: approve, runId: 'run-1' })

      const result = await Effect.runPromise(tool.run({ path: target }))

      expect(result).toEqual({ ok: false, error: 'FileNotFound' })
    }))

  it('reports invalid_args when path is missing', async () => {
    const tool = deleteFileTool({ bridge: approve, runId: 'run-1' })

    const result = await Effect.runPromise(tool.run({}))

    expect(result).toEqual({ ok: false, error: 'invalid_args' })
  })
})
