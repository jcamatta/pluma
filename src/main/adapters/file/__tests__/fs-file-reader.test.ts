// Tests for the FileSystem-backed FileReader adapter against a real temp directory. Verifies it
// returns an existing file's content, reports a missing target, and refuses to read a directory.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import { describe, expect, it } from 'vitest'
import * as NodeContext from '@effect/platform-node/NodeContext'
import { FileReader } from '../../../application/file/port/file-reader.port'
import { FsFileReaderLive } from '../fs-file-reader'

const run = (target: string): Promise<Exit.Exit<string, { readonly _tag: string }>> =>
  Effect.runPromiseExit(
    Effect.flatMap(FileReader, (reader) => reader.readFile(target)).pipe(
      Effect.provide(FsFileReaderLive),
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

describe('FsFileReaderLive readFile', () => {
  it('returns the content of an existing file', () =>
    withTempDir(async (dir) => {
      const target = join(dir, 'note.md')
      writeFileSync(target, '# Hello')
      const exit = await run(target)

      expect(exit).toStrictEqual(Exit.succeed('# Hello'))
    }))

  it('fails with FileNotFound when the target does not exist', () =>
    withTempDir(async (dir) => {
      const target = join(dir, 'missing.md')
      const exit = await run(target)

      expect(exit).toStrictEqual(Exit.fail(expect.objectContaining({ _tag: 'FileNotFound' })))
    }))

  it('fails with FileNotFound when the target is a directory', () =>
    withTempDir(async (dir) => {
      const target = join(dir, 'subdir')
      mkdirSync(target)
      const exit = await run(target)

      expect(exit).toStrictEqual(Exit.fail(expect.objectContaining({ _tag: 'FileNotFound' })))
    }))
})
