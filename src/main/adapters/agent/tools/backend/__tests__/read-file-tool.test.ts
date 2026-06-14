import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as Effect from 'effect/Effect'
import { describe, expect, it } from 'vitest'
import { readFileTool } from '../read-file-tool'

const withTempDir = async (body: (dir: string) => Promise<void>): Promise<void> => {
  const dir = mkdtempSync(join(tmpdir(), 'pluma-'))
  try {
    await body(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe('readFileTool', () => {
  it('exposes a read_file spec', () => {
    expect(readFileTool.spec.name).toBe('read_file')
  })

  it('reads an existing markdown file as text output', () =>
    withTempDir(async (dir) => {
      const target = join(dir, 'note.md')
      writeFileSync(target, '# Hello world')

      const result = await Effect.runPromise(readFileTool.run({ path: target }))

      expect(result).toEqual({ ok: true, output: { type: 'text', text: '# Hello world' } })
    }))

  it('reports FileNotFound for a missing file', () =>
    withTempDir(async (dir) => {
      const target = join(dir, 'missing.md')

      const result = await Effect.runPromise(readFileTool.run({ path: target }))

      expect(result).toEqual({ ok: false, error: 'FileNotFound' })
    }))

  it('reports InvalidPath for a non-markdown path', () =>
    withTempDir(async (dir) => {
      const target = join(dir, 'note.txt')
      writeFileSync(target, 'plain')

      const result = await Effect.runPromise(readFileTool.run({ path: target }))

      expect(result).toEqual({ ok: false, error: 'InvalidPath' })
    }))

  it('reports invalid_args when path is missing', async () => {
    const result = await Effect.runPromise(readFileTool.run({}))

    expect(result).toEqual({ ok: false, error: 'invalid_args' })
  })
})
