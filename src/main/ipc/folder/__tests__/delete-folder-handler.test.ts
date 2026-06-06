// Tests for the delete-folder IPC handler. Verifies it serializes the use-case outcome into a plain
// Result: ok:true with the path on success, ok:false with a tagged error on each failure.

import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { handleDeleteFolder } from '../delete-folder-handler'

const withTempDir = async (body: (dir: string) => Promise<void>): Promise<void> => {
  const dir = mkdtempSync(join(tmpdir(), 'pluma-ipc-'))
  try {
    await body(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe('handleDeleteFolder', () => {
  it('returns ok:true with the validated path and removes the folder and its contents', () =>
    withTempDir(async (dir) => {
      const target = join(dir, 'drafts')
      mkdirSync(target)
      writeFileSync(join(target, 'note.md'), 'content')
      const result = await handleDeleteFolder(target)

      expect(result).toStrictEqual({ ok: true, value: target })
      expect(existsSync(target)).toBe(false)
    }))

  it('returns ok:false with InvalidFolderPath for a blank path', async () => {
    const result = await handleDeleteFolder('   ')

    expect(result).toStrictEqual({
      ok: false,
      error: { _tag: 'InvalidFolderPath', path: '   ' }
    })
  })

  it('returns ok:false with FolderNotFound when the target is missing', () =>
    withTempDir(async (dir) => {
      const target = join(dir, 'missing')
      const result = await handleDeleteFolder(target)

      expect(result).toStrictEqual({
        ok: false,
        error: { _tag: 'FolderNotFound', path: target }
      })
    }))
})
