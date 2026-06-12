// Tests for the FileSystem-backed FolderWriter adapter's renameFolder against a real temp directory.
// Verifies it moves an existing folder and its contents, reports a missing or non-directory source,
// and refuses to overwrite an existing destination.

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import { describe, expect, it } from 'vitest'
import * as NodeContext from '@effect/platform-node/NodeContext'
import { FolderWriter } from '../../../application/folder/port/folder-writer.port'
import { FsFolderWriterLive } from '../fs-folder-writer'

const run = (
  source: string,
  destination: string
): Promise<Exit.Exit<void, { readonly _tag: string }>> =>
  Effect.runPromiseExit(
    Effect.flatMap(FolderWriter, (writer) => writer.renameFolder(source, destination)).pipe(
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

describe('FsFolderWriterLive renameFolder', () => {
  it('moves the folder and all of its contents to the destination path', () =>
    withTempDir(async (dir) => {
      const source = join(dir, 'old')
      const destination = join(dir, 'new')
      mkdirSync(source)
      writeFileSync(join(source, 'note.md'), 'content')
      const exit = await run(source, destination)

      expect(Exit.isSuccess(exit)).toBe(true)
      expect(existsSync(source)).toBe(false)
      expect(readFileSync(join(destination, 'note.md'), 'utf8')).toBe('content')
    }))

  it('fails with FolderNotFound when the source does not exist', () =>
    withTempDir(async (dir) => {
      const exit = await run(join(dir, 'missing'), join(dir, 'new'))

      expect(exit).toStrictEqual(Exit.fail(expect.objectContaining({ _tag: 'FolderNotFound' })))
    }))

  it('fails with FolderNotFound when the source is a regular file', () =>
    withTempDir(async (dir) => {
      const source = join(dir, 'afile.md')
      writeFileSync(source, 'content')
      const exit = await run(source, join(dir, 'new'))

      expect(exit).toStrictEqual(Exit.fail(expect.objectContaining({ _tag: 'FolderNotFound' })))
      expect(existsSync(source)).toBe(true)
    }))

  it('fails with FolderAlreadyExists when the destination is already taken, leaving the source', () =>
    withTempDir(async (dir) => {
      const source = join(dir, 'old')
      const destination = join(dir, 'new')
      mkdirSync(source)
      mkdirSync(destination)
      const exit = await run(source, destination)

      expect(exit).toStrictEqual(
        Exit.fail(expect.objectContaining({ _tag: 'FolderAlreadyExists' }))
      )
      expect(existsSync(source)).toBe(true)
    }))
})
