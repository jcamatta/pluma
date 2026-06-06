// Tests for the delete-file IPC handler. Verifies it serializes the use-case outcome into a plain
// Result: ok:true with the path on success, ok:false with a tagged error on each failure.

import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { handleDeleteFile } from '../delete-file-handler'

const withTempDir = async (body: (dir: string) => Promise<void>): Promise<void> => {
  const dir = mkdtempSync(join(tmpdir(), 'pluma-ipc-'))
  try {
    await body(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe('handleDeleteFile', () => {
  it('returns ok:true with the validated path and removes the file', () =>
    withTempDir(async (dir) => {
      const target = join(dir, 'note.md')
      writeFileSync(target, 'content')
      const result = await handleDeleteFile(target)

      expect(result).toStrictEqual({ ok: true, value: target })
      expect(existsSync(target)).toBe(false)
    }))

  it('returns ok:false with InvalidPath for a non-md path', () =>
    withTempDir(async (dir) => {
      const target = join(dir, 'note.txt')
      const result = await handleDeleteFile(target)

      expect(result).toStrictEqual({ ok: false, error: { _tag: 'InvalidPath', path: target } })
    }))

  it('returns ok:false with FileNotFound when the target is missing', () =>
    withTempDir(async (dir) => {
      const target = join(dir, 'missing.md')
      const result = await handleDeleteFile(target)

      expect(result).toStrictEqual({
        ok: false,
        error: { _tag: 'FileNotFound', path: target }
      })
    }))
})
