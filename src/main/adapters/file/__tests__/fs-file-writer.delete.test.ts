// Tests for the FileSystem-backed FileWriter adapter's deleteFile against a real temp directory.
// Verifies it removes an existing file, reports a missing target, and refuses to delete a directory.

import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import { describe, expect, it } from 'vitest'
import * as NodeContext from '@effect/platform-node/NodeContext'
import { FileWriter } from '../../../application/file/port/file-writer.port'
import { FsFileWriterLive } from '../fs-file-writer'

const run = (target: string): Promise<Exit.Exit<void, { readonly _tag: string }>> =>
  Effect.runPromiseExit(
    Effect.flatMap(FileWriter, (writer) => writer.deleteFile(target)).pipe(
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

describe('FsFileWriterLive deleteFile', () => {
  it('removes the file at the target path', () =>
    withTempDir(async (dir) => {
      const target = join(dir, 'note.md')
      writeFileSync(target, 'content')
      const exit = await run(target)

      expect(Exit.isSuccess(exit)).toBe(true)
      expect(existsSync(target)).toBe(false)
    }))

  it('fails with FileNotFound when the target does not exist', () =>
    withTempDir(async (dir) => {
      const target = join(dir, 'missing.md')
      const exit = await run(target)

      expect(exit).toStrictEqual(Exit.fail(expect.objectContaining({ _tag: 'FileNotFound' })))
    }))

  it('fails with FileNotFound and leaves a directory untouched when the target is a directory', () =>
    withTempDir(async (dir) => {
      const target = join(dir, 'subdir')
      mkdirSync(target)
      const exit = await run(target)

      expect(exit).toStrictEqual(Exit.fail(expect.objectContaining({ _tag: 'FileNotFound' })))
      expect(existsSync(target)).toBe(true)
    }))
})
