// Tests for the FileSystem-backed FileWriter adapter's renameFile against a real temp directory.
// Verifies it moves an existing file and its contents, reports a missing or non-file source, and
// refuses to overwrite an existing destination.

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import { describe, expect, it } from 'vitest'
import * as NodeContext from '@effect/platform-node/NodeContext'
import { FileWriter } from '../../../application/file/port/file-writer.port'
import { FsFileWriterLive } from '../fs-file-writer'

const run = (
  source: string,
  destination: string
): Promise<Exit.Exit<void, { readonly _tag: string }>> =>
  Effect.runPromiseExit(
    Effect.flatMap(FileWriter, (writer) => writer.renameFile(source, destination)).pipe(
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

describe('FsFileWriterLive renameFile', () => {
  it('moves the file and its contents to the destination path', () =>
    withTempDir(async (dir) => {
      const source = join(dir, 'old.md')
      const destination = join(dir, 'new.md')
      writeFileSync(source, 'content')
      const exit = await run(source, destination)

      expect(Exit.isSuccess(exit)).toBe(true)
      expect(existsSync(source)).toBe(false)
      expect(readFileSync(destination, 'utf8')).toBe('content')
    }))

  it('fails with FileNotFound when the source does not exist', () =>
    withTempDir(async (dir) => {
      const exit = await run(join(dir, 'missing.md'), join(dir, 'new.md'))

      expect(exit).toStrictEqual(Exit.fail(expect.objectContaining({ _tag: 'FileNotFound' })))
    }))

  it('fails with FileNotFound when the source is a directory', () =>
    withTempDir(async (dir) => {
      const source = join(dir, 'adir')
      mkdirSync(source)
      const exit = await run(source, join(dir, 'new.md'))

      expect(exit).toStrictEqual(Exit.fail(expect.objectContaining({ _tag: 'FileNotFound' })))
      expect(existsSync(source)).toBe(true)
    }))

  it('fails with FileAlreadyExists when the destination is already taken, leaving the source', () =>
    withTempDir(async (dir) => {
      const source = join(dir, 'old.md')
      const destination = join(dir, 'new.md')
      writeFileSync(source, 'content')
      writeFileSync(destination, 'other')
      const exit = await run(source, destination)

      expect(exit).toStrictEqual(Exit.fail(expect.objectContaining({ _tag: 'FileAlreadyExists' })))
      expect(existsSync(source)).toBe(true)
    }))
})
