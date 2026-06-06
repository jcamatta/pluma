// Tests for the list-folder IPC handler. Verifies it serializes the use-case outcome into a plain
// Result: ok:true with the entries on success, ok:false with a tagged error on each failure.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { FolderEntry } from '../../../application/folder/data/entry'
import { handleListFolder } from '../list-folder-handler'

const byName = (a: FolderEntry, b: FolderEntry): number => a.name.localeCompare(b.name)

const withTempDir = async (body: (dir: string) => Promise<void>): Promise<void> => {
  const dir = mkdtempSync(join(tmpdir(), 'pluma-ipc-'))
  try {
    await body(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe('handleListFolder', () => {
  it('returns ok:true with the folder entries', () =>
    withTempDir(async (dir) => {
      mkdirSync(join(dir, 'ideas'))
      writeFileSync(join(dir, 'todo.md'), 'content')
      const result = await handleListFolder(dir)

      expect(result.ok).toBe(true)
      if (result.ok) {
        const sorted = [...result.value].sort(byName)
        expect(sorted).toStrictEqual([
          { name: 'ideas', type: 'directory' },
          { name: 'todo.md', type: 'file' }
        ])
      }
    }))

  it('returns ok:false with InvalidFolderPath for a blank path', async () => {
    const result = await handleListFolder('   ')

    expect(result).toStrictEqual({
      ok: false,
      error: { _tag: 'InvalidFolderPath', path: '   ' }
    })
  })

  it('returns ok:false with FolderNotFound when the target is missing', () =>
    withTempDir(async (dir) => {
      const target = join(dir, 'missing')
      const result = await handleListFolder(target)

      expect(result).toStrictEqual({
        ok: false,
        error: { _tag: 'FolderNotFound', path: target }
      })
    }))
})
