// Tests for the FileSystem-backed FolderWriter adapter's deleteFolder against a real temp directory.
// Verifies it removes an existing folder and its contents, reports a missing target, and refuses to
// delete a regular file.

import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import { describe, expect, it } from 'vitest'
import * as NodeContext from '@effect/platform-node/NodeContext'
import { FolderWriter } from '../../../application/folder/port/folder-writer.port'
import { FsFolderWriterLive } from '../fs-folder-writer'

const run = (target: string): Promise<Exit.Exit<void, { readonly _tag: string }>> =>
  Effect.runPromiseExit(
    Effect.flatMap(FolderWriter, (writer) => writer.deleteFolder(target)).pipe(
      Effect.provide(FsFolderWriterLive),
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

describe('FsFolderWriterLive deleteFolder', () => {
  it('removes the folder and all of its contents at the target path', () =>
    withTempDir(async (dir) => {
      const target = join(dir, 'drafts')
      mkdirSync(target)
      writeFileSync(join(target, 'note.md'), 'content')
      mkdirSync(join(target, 'nested'))
      const exit = await run(target)

      expect(Exit.isSuccess(exit)).toBe(true)
      expect(existsSync(target)).toBe(false)
    }))

  it('fails with FolderNotFound when the target does not exist', () =>
    withTempDir(async (dir) => {
      const target = join(dir, 'missing')
      const exit = await run(target)

      expect(exit).toStrictEqual(Exit.fail(expect.objectContaining({ _tag: 'FolderNotFound' })))
    }))

  it('fails with FolderNotFound and leaves a file untouched when the target is a regular file', () =>
    withTempDir(async (dir) => {
      const target = join(dir, 'afile.md')
      writeFileSync(target, 'content')
      const exit = await run(target)

      expect(exit).toStrictEqual(Exit.fail(expect.objectContaining({ _tag: 'FolderNotFound' })))
      expect(existsSync(target)).toBe(true)
    }))
})
