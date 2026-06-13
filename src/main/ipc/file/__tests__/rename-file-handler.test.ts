// Tests for the rename-file IPC handler. Verifies it serializes the use-case outcome into a plain
// Result: ok:true with the new path on success, ok:false with a tagged error on each failure.

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { handleRenameFile } from '../rename-file-handler'

const withTempDir = async (body: (dir: string) => Promise<void>): Promise<void> => {
  const dir = mkdtempSync(join(tmpdir(), 'pluma-ipc-'))
  try {
    await body(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe('handleRenameFile', () => {
  it('returns ok:true with the new path and moves the file', () =>
    withTempDir(async (dir) => {
      const oldPath = join(dir, 'old.md')
      const newPath = join(dir, 'new.md')
      writeFileSync(oldPath, 'content')
      const result = await handleRenameFile({ oldPath, newPath })

      expect(result).toStrictEqual({ ok: true, value: newPath })
      expect(existsSync(oldPath)).toBe(false)
      expect(readFileSync(newPath, 'utf8')).toBe('content')
    }))

  it('returns ok:false with InvalidPath for a non-markdown old path', async () => {
    const result = await handleRenameFile({ oldPath: '/notes/old', newPath: '/notes/new.md' })

    expect(result).toStrictEqual({
      ok: false,
      error: { _tag: 'InvalidPath', path: '/notes/old' }
    })
  })

  it('returns ok:false with FileNotFound when the source is missing', () =>
    withTempDir(async (dir) => {
      const oldPath = join(dir, 'missing.md')
      const newPath = join(dir, 'new.md')
      const result = await handleRenameFile({ oldPath, newPath })

      expect(result).toStrictEqual({
        ok: false,
        error: { _tag: 'FileNotFound', path: oldPath }
      })
    }))

  it('returns ok:false with FileAlreadyExists when the destination is taken', () =>
    withTempDir(async (dir) => {
      const oldPath = join(dir, 'old.md')
      const newPath = join(dir, 'new.md')
      writeFileSync(oldPath, 'content')
      writeFileSync(newPath, 'other')
      const result = await handleRenameFile({ oldPath, newPath })

      expect(result).toStrictEqual({
        ok: false,
        error: { _tag: 'FileAlreadyExists', path: newPath }
      })
    }))
})
