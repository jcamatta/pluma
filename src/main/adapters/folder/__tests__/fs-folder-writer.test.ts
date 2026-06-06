// Tests for the FileSystem-backed FolderWriter adapter against a real temp directory. Verifies it
// creates a folder, refuses an existing target, reports a missing parent, and fails on bad targets.

import { existsSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs'
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
    Effect.flatMap(FolderWriter, (writer) => writer.createFolder(target)).pipe(
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

describe('FsFolderWriterLive', () => {
  it('creates a folder at the target path', () =>
    withTempDir(async (dir) => {
      const target = join(dir, 'drafts')
      const exit = await run(target)

      expect(Exit.isSuccess(exit)).toBe(true)
      expect(statSync(target).isDirectory()).toBe(true)
    }))

  it('fails with FolderAlreadyExists when the target already exists', () =>
    withTempDir(async (dir) => {
      const target = join(dir, 'drafts')
      const exit1 = await run(target)
      const exit2 = await run(target)

      expect(Exit.isSuccess(exit1)).toBe(true)
      expect(exit2).toStrictEqual(
        Exit.fail(expect.objectContaining({ _tag: 'FolderAlreadyExists' }))
      )
    }))

  it('fails with ParentDirectoryNotFound when the parent directory is missing', () =>
    withTempDir(async (dir) => {
      const target = join(dir, 'missing', 'drafts')
      const exit = await run(target)

      expect(exit).toStrictEqual(
        Exit.fail(expect.objectContaining({ _tag: 'ParentDirectoryNotFound' }))
      )
    }))

  it('fails with FolderCreationFailed when the parent path is a file, not a directory', () =>
    withTempDir(async (dir) => {
      const fileAsParent = join(dir, 'afile')
      writeFileSync(fileAsParent, 'not a directory')
      const target = join(fileAsParent, 'drafts')
      const exit = await run(target)

      expect(exit).toStrictEqual(
        Exit.fail(expect.objectContaining({ _tag: 'FolderCreationFailed' }))
      )
      expect(existsSync(target)).toBe(false)
    }))
})
