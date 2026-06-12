// Tests for the rename-folder IPC handler. Verifies it serializes the use-case outcome into a plain
// Result: ok:true with the new path on success, ok:false with a tagged error on each failure.

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { handleRenameFolder } from '../rename-folder-handler'

const withTempDir = async (body: (dir: string) => Promise<void>): Promise<void> => {
  const dir = mkdtempSync(join(tmpdir(), 'pluma-ipc-'))
  try {
    await body(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe('handleRenameFolder', () => {
  it('returns ok:true with the new path and moves the folder and its contents', () =>
    withTempDir(async (dir) => {
      const oldPath = join(dir, 'old')
      const newPath = join(dir, 'new')
      mkdirSync(oldPath)
      writeFileSync(join(oldPath, 'note.md'), 'content')
      const result = await handleRenameFolder({ oldPath, newPath })

      expect(result).toStrictEqual({ ok: true, value: newPath })
      expect(existsSync(oldPath)).toBe(false)
      expect(readFileSync(join(newPath, 'note.md'), 'utf8')).toBe('content')
    }))

  it('returns ok:false with InvalidFolderPath for a blank old path', async () => {
    const result = await handleRenameFolder({ oldPath: '   ', newPath: '/notes/new' })

    expect(result).toStrictEqual({
      ok: false,
      error: { _tag: 'InvalidFolderPath', path: '   ' }
    })
  })

  it('returns ok:false with FolderNotFound when the source is missing', () =>
    withTempDir(async (dir) => {
      const oldPath = join(dir, 'missing')
      const newPath = join(dir, 'new')
      const result = await handleRenameFolder({ oldPath, newPath })

      expect(result).toStrictEqual({
        ok: false,
        error: { _tag: 'FolderNotFound', path: oldPath }
      })
    }))

  it('returns ok:false with FolderAlreadyExists when the destination is taken', () =>
    withTempDir(async (dir) => {
      const oldPath = join(dir, 'old')
      const newPath = join(dir, 'new')
      mkdirSync(oldPath)
      mkdirSync(newPath)
      const result = await handleRenameFolder({ oldPath, newPath })

      expect(result).toStrictEqual({
        ok: false,
        error: { _tag: 'FolderAlreadyExists', path: newPath }
      })
    }))
})
