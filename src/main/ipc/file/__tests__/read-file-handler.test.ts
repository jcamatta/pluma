// Tests for the read-file IPC handler. Verifies it serializes the use-case outcome into a plain
// Result: ok:true with the content on success, ok:false with a tagged error on each failure.

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { handleReadFile } from '../read-file-handler'

const withTempDir = async (body: (dir: string) => Promise<void>): Promise<void> => {
  const dir = mkdtempSync(join(tmpdir(), 'pluma-ipc-'))
  try {
    await body(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe('handleReadFile', () => {
  it('returns ok:true with the file content', () =>
    withTempDir(async (dir) => {
      const target = join(dir, 'note.md')
      writeFileSync(target, '# Hello')
      const result = await handleReadFile(target)

      expect(result).toStrictEqual({ ok: true, value: '# Hello' })
    }))

  it('returns ok:false with InvalidPath for a non-md path', () =>
    withTempDir(async (dir) => {
      const target = join(dir, 'note.txt')
      const result = await handleReadFile(target)

      expect(result).toStrictEqual({ ok: false, error: { _tag: 'InvalidPath', path: target } })
    }))

  it('returns ok:false with FileNotFound when the target does not exist', () =>
    withTempDir(async (dir) => {
      const target = join(dir, 'missing.md')
      const result = await handleReadFile(target)

      expect(result).toStrictEqual({ ok: false, error: { _tag: 'FileNotFound', path: target } })
    }))
})
