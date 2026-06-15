import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as Effect from 'effect/Effect'
import { describe, expect, it } from 'vitest'
import { listFolderTool } from '../list-folder-tool'

const withTempDir = async (body: (dir: string) => Promise<void>): Promise<void> => {
  const dir = mkdtempSync(join(tmpdir(), 'pluma-'))
  try {
    await body(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe('listFolderTool', () => {
  it('exposes a list_folder spec', () => {
    expect(listFolderTool(undefined).spec.name).toBe('list_folder')
  })

  it('lists a folder children with absolute paths', () =>
    withTempDir(async (dir) => {
      writeFileSync(join(dir, 'note.md'), '# Hello')
      mkdirSync(join(dir, 'chapters'))

      const result = await Effect.runPromise(listFolderTool(undefined).run({ path: dir }))

      expect(result).toEqual({
        ok: true,
        output: {
          type: 'json',
          value: expect.arrayContaining([
            { name: 'chapters', type: 'directory', path: join(dir, 'chapters') },
            { name: 'note.md', type: 'file', path: join(dir, 'note.md') }
          ])
        }
      })
      if (result.ok && result.output.type === 'json' && Array.isArray(result.output.value)) {
        expect(result.output.value).toHaveLength(2)
      }
    }))

  it('reports FolderNotFound for a missing folder', () =>
    withTempDir(async (dir) => {
      const target = join(dir, 'missing')

      const result = await Effect.runPromise(listFolderTool(undefined).run({ path: target }))

      expect(result).toEqual({ ok: false, error: 'FolderNotFound' })
    }))

  it('lists the cwd when no path arg is provided', () =>
    withTempDir(async (dir) => {
      writeFileSync(join(dir, 'note.md'), '# Hello')

      const result = await Effect.runPromise(listFolderTool(dir).run({}))

      expect(result).toEqual({
        ok: true,
        output: {
          type: 'json',
          value: [{ name: 'note.md', type: 'file', path: join(dir, 'note.md') }]
        }
      })
    }))

  it('reports no_workspace when no path arg and no cwd', async () => {
    const result = await Effect.runPromise(listFolderTool(undefined).run({}))

    expect(result).toEqual({ ok: false, error: 'no_workspace' })
  })

  it('reports invalid_args when path is not a string', async () => {
    const result = await Effect.runPromise(listFolderTool(undefined).run({ path: 5 }))

    expect(result).toEqual({ ok: false, error: 'invalid_args' })
  })
})
