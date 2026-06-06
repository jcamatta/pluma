// Tests for the FileSystem-backed FolderReader adapter's listFolder against a real temp directory.
// Verifies it returns the immediate children classified as file or directory, reports a missing
// target, and refuses to list a regular file.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import { describe, expect, it } from 'vitest'
import * as NodeContext from '@effect/platform-node/NodeContext'
import type { FolderEntry } from '../../../application/folder/data/entry'
import { FolderReader } from '../../../application/folder/port/folder-reader.port'
import { FsFolderReaderLive } from '../fs-folder-reader'

const byName = (a: FolderEntry, b: FolderEntry): number => a.name.localeCompare(b.name)

const run = (
  target: string
): Promise<Exit.Exit<ReadonlyArray<FolderEntry>, { readonly _tag: string }>> =>
  Effect.runPromiseExit(
    Effect.flatMap(FolderReader, (reader) => reader.listFolder(target)).pipe(
      Effect.provide(FsFolderReaderLive),
      Effect.provide(NodeContext.layer)
    )
  )

const withTempDir = async (body: (dir: string) => Promise<void>): Promise<void> => {
  const dir = mkdtempSync(join(tmpdir(), 'pluma-'))
  try {
    await body(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe('FsFolderReaderLive listFolder', () => {
  it('returns the immediate children classified as file or directory', () =>
    withTempDir(async (dir) => {
      mkdirSync(join(dir, 'ideas'))
      writeFileSync(join(dir, 'todo.md'), 'content')
      const exit = await run(dir)

      expect(Exit.isSuccess(exit)).toBe(true)
      if (Exit.isSuccess(exit)) {
        const sorted = [...exit.value].sort(byName)
        expect(sorted).toStrictEqual([
          { name: 'ideas', type: 'directory' },
          { name: 'todo.md', type: 'file' }
        ])
      }
    }))

  it('returns an empty array for an empty directory', () =>
    withTempDir(async (dir) => {
      const exit = await run(dir)
      expect(exit).toStrictEqual(Exit.succeed([]))
    }))

  it('fails with FolderNotFound when the target does not exist', () =>
    withTempDir(async (dir) => {
      const target = join(dir, 'missing')
      const exit = await run(target)

      expect(exit).toStrictEqual(Exit.fail(expect.objectContaining({ _tag: 'FolderNotFound' })))
    }))

  it('fails with FolderNotFound when the target is a regular file', () =>
    withTempDir(async (dir) => {
      const target = join(dir, 'afile.md')
      writeFileSync(target, 'content')
      const exit = await run(target)

      expect(exit).toStrictEqual(Exit.fail(expect.objectContaining({ _tag: 'FolderNotFound' })))
    }))
})
