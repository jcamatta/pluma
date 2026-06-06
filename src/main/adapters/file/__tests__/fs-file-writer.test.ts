// Tests for the FileSystem-backed FileWriter adapter against a real temp directory. Verifies it
// writes an empty file, refuses an existing target, and reports a missing parent directory.

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import { describe, expect, it } from 'vitest'
import * as NodeContext from '@effect/platform-node/NodeContext'
import { FileWriter } from '../../../application/file/file-writer.port'
import { FsFileWriterLive } from '../fs-file-writer'

const run = (target: string): Promise<Exit.Exit<void, { readonly _tag: string }>> =>
  Effect.runPromiseExit(
    Effect.flatMap(FileWriter, (writer) => writer.createEmptyFile(target)).pipe(
      Effect.provide(FsFileWriterLive),
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

describe('FsFileWriterLive', () => {
  it('creates an empty file at the target path', () =>
    withTempDir(async (dir) => {
      const target = join(dir, 'note.md')
      const exit = await run(target)

      expect(Exit.isSuccess(exit)).toBe(true)
      expect(readFileSync(target, 'utf8')).toBe('')
    }))

  it('fails with FileAlreadyExists when the target already exists', () =>
    withTempDir(async (dir) => {
      const target = join(dir, 'note.md')
      writeFileSync(target, 'existing')
      const exit = await run(target)

      expect(exit).toStrictEqual(Exit.fail(expect.objectContaining({ _tag: 'FileAlreadyExists' })))
      expect(readFileSync(target, 'utf8')).toBe('existing')
    }))

  it('fails with DirectoryNotFound when the parent directory is missing', () =>
    withTempDir(async (dir) => {
      const target = join(dir, 'missing', 'note.md')
      const exit = await run(target)

      expect(exit).toStrictEqual(Exit.fail(expect.objectContaining({ _tag: 'DirectoryNotFound' })))
    }))

  it('fails with FileWriteFailed when the write cannot complete', () =>
    withTempDir(async (dir) => {
      const fileAsParent = join(dir, 'afile')
      writeFileSync(fileAsParent, 'not a directory')
      const target = join(fileAsParent, 'note.md')
      const exit = await run(target)

      expect(exit).toStrictEqual(Exit.fail(expect.objectContaining({ _tag: 'FileWriteFailed' })))
    }))
})
