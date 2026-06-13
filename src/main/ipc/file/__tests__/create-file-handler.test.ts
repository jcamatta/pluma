// Tests for the create-file IPC handler. Verifies it serializes the use-case outcome into a plain
// Result: ok:true with the path on success, ok:false with a tagged error on each failure.

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { handleCreateFile } from '../create-file-handler'

const withTempDir = async (body: (dir: string) => Promise<void>): Promise<void> => {
  const dir = mkdtempSync(join(tmpdir(), 'pluma-ipc-'))
  try {
    await body(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe('handleCreateFile', () => {
  it('returns ok:true with the validated path and writes the file', () =>
    withTempDir(async (dir) => {
      const target = join(dir, 'note.md')
      const result = await handleCreateFile(target)

      expect(result).toStrictEqual({ ok: true, value: target })
      expect(readFileSync(target, 'utf8')).toBe('')
    }))

  it('returns ok:true with the .md path when the name omits the extension', () =>
    withTempDir(async (dir) => {
      const result = await handleCreateFile(join(dir, 'note'))

      expect(result).toStrictEqual({ ok: true, value: join(dir, 'note.md') })
      expect(readFileSync(join(dir, 'note.md'), 'utf8')).toBe('')
    }))

  it('returns ok:false with InvalidPath for a blank path', async () => {
    const result = await handleCreateFile('   ')

    expect(result).toStrictEqual({ ok: false, error: { _tag: 'InvalidPath', path: '' } })
  })

  it('returns ok:false with DirectoryNotFound when the parent is missing', () =>
    withTempDir(async (dir) => {
      const target = join(dir, 'missing', 'note.md')
      const result = await handleCreateFile(target)

      expect(result).toStrictEqual({
        ok: false,
        error: { _tag: 'DirectoryNotFound', path: target }
      })
    }))
})
