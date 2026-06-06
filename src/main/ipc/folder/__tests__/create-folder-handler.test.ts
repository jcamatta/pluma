// Tests for the create-folder IPC handler. Verifies it serializes the use-case outcome into a plain
// Result: ok:true with the path on success, ok:false with a tagged error on each failure.

import { mkdtempSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { handleCreateFolder } from '../create-folder-handler'

const withTempDir = async (body: (dir: string) => Promise<void>): Promise<void> => {
  const dir = mkdtempSync(join(tmpdir(), 'pluma-ipc-'))
  try {
    await body(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe('handleCreateFolder', () => {
  it('returns ok:true with the validated path and creates the folder', () =>
    withTempDir(async (dir) => {
      const target = join(dir, 'drafts')
      const result = await handleCreateFolder(target)

      expect(result).toStrictEqual({ ok: true, value: target })
      expect(statSync(target).isDirectory()).toBe(true)
    }))

  it('returns ok:false with InvalidFolderPath for a reserved .pluma segment', () =>
    withTempDir(async (dir) => {
      const target = join(dir, '.pluma')
      const result = await handleCreateFolder(target)

      expect(result).toStrictEqual({
        ok: false,
        error: { _tag: 'InvalidFolderPath', path: target }
      })
    }))

  it('returns ok:false with ParentDirectoryNotFound when the parent is missing', () =>
    withTempDir(async (dir) => {
      const target = join(dir, 'missing', 'drafts')
      const result = await handleCreateFolder(target)

      expect(result).toStrictEqual({
        ok: false,
        error: { _tag: 'ParentDirectoryNotFound', path: target }
      })
    }))
})
