// Tests for the renameFile use case against an in-memory FileWriter fake. Covers the success path,
// the .md-extension defaulting of a bare new name, the markdown-path validation rules for both paths,
// and each typed failure the port can produce.

import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as Layer from 'effect/Layer'
import { describe, expect, it } from 'vitest'
import { FileNotFound } from '../../error/file-not-found'
import { FileAlreadyExists } from '../../error/file-already-exists'
import { FileRenameFailed } from '../../error/file-rename-failed'
import { renameFile } from '../rename-file'
import { FileWriter } from '../../port/file-writer.port'
import type { FileWriterPort } from '../../port/file-writer.port'

const writerThatSucceeds = (
  renamed: Array<readonly [string, string]>
): Layer.Layer<FileWriterPort> =>
  Layer.succeed(
    FileWriter,
    FileWriter.of({
      createEmptyFile: () => Effect.void,
      deleteFile: () => Effect.void,
      writeFile: () => Effect.void,
      renameFile: (oldPath, newPath) =>
        Effect.sync(() => {
          renamed.push([oldPath, newPath])
        })
    })
  )

const writerThatFails = (
  error: FileNotFound | FileAlreadyExists | FileRenameFailed
): Layer.Layer<FileWriterPort> =>
  Layer.succeed(
    FileWriter,
    FileWriter.of({
      createEmptyFile: () => Effect.void,
      deleteFile: () => Effect.void,
      writeFile: () => Effect.void,
      renameFile: () => Effect.fail(error)
    })
  )

const run = <A, E>(
  effect: Effect.Effect<A, E, FileWriterPort>,
  layer: Layer.Layer<FileWriterPort>
): Exit.Exit<A, E> => Effect.runSyncExit(Effect.provide(effect, layer))

describe('renameFile', () => {
  it('renames the file and returns the validated new path on success', () => {
    const renamed: Array<readonly [string, string]> = []
    const exit = run(renameFile('  /notes/old.md ', ' /notes/new.md '), writerThatSucceeds(renamed))

    expect(exit).toStrictEqual(Exit.succeed('/notes/new.md'))
    expect(renamed).toStrictEqual([['/notes/old.md', '/notes/new.md']])
  })

  it('fails with InvalidPath when the old path is not markdown, without touching the writer', () => {
    const renamed: Array<readonly [string, string]> = []
    const exit = run(renameFile('/notes/old', '/notes/new.md'), writerThatSucceeds(renamed))

    expect(Exit.isFailure(exit)).toBe(true)
    expect(renamed).toStrictEqual([])
    expect(exit).toStrictEqual(Exit.fail(expect.objectContaining({ _tag: 'InvalidPath' })))
  })

  it('defaults a bare new name to a .md file, renaming to and returning the extended path', () => {
    const renamed: Array<readonly [string, string]> = []
    const exit = run(renameFile('/notes/old.md', '/notes/new'), writerThatSucceeds(renamed))

    expect(exit).toStrictEqual(Exit.succeed('/notes/new.md'))
    expect(renamed).toStrictEqual([['/notes/old.md', '/notes/new.md']])
  })

  it('propagates FileNotFound from the writer', () => {
    const error = new FileNotFound({ path: '/notes/old.md' })
    const exit = run(renameFile('/notes/old.md', '/notes/new.md'), writerThatFails(error))
    expect(exit).toStrictEqual(Exit.fail(error))
  })

  it('propagates FileAlreadyExists from the writer', () => {
    const error = new FileAlreadyExists({ path: '/notes/new.md' })
    const exit = run(renameFile('/notes/old.md', '/notes/new.md'), writerThatFails(error))
    expect(exit).toStrictEqual(Exit.fail(error))
  })

  it('propagates FileRenameFailed from the writer', () => {
    const error = new FileRenameFailed({ path: '/notes/new.md' })
    const exit = run(renameFile('/notes/old.md', '/notes/new.md'), writerThatFails(error))
    expect(exit).toStrictEqual(Exit.fail(error))
  })
})
