// Tests for the createFile use case against an in-memory FileWriter fake. Covers the success path,
// the path-validation failure, and each typed failure the port can produce.

import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as Layer from 'effect/Layer'
import { describe, expect, it } from 'vitest'
import { FileAlreadyExists } from '../../error/file-already-exists'
import { DirectoryNotFound } from '../../error/directory-not-found'
import { FileWriteFailed } from '../../error/file-write-failed'
import { createFile } from '../create-file'
import { FileWriter } from '../../port/file-writer.port'
import type { FileWriterPort } from '../../port/file-writer.port'

const writerThatSucceeds = (created: string[]): Layer.Layer<FileWriterPort> =>
  Layer.succeed(
    FileWriter,
    FileWriter.of({
      createEmptyFile: (path) =>
        Effect.sync(() => {
          created.push(path)
        }),
      deleteFile: () => Effect.void,
      renameFile: () => Effect.void,
      writeFile: () => Effect.void
    })
  )

const writerThatFails = (
  error: FileAlreadyExists | DirectoryNotFound | FileWriteFailed
): Layer.Layer<FileWriterPort> =>
  Layer.succeed(
    FileWriter,
    FileWriter.of({
      createEmptyFile: () => Effect.fail(error),
      deleteFile: () => Effect.void,
      renameFile: () => Effect.void,
      writeFile: () => Effect.void
    })
  )

const run = <A, E>(
  effect: Effect.Effect<A, E, FileWriterPort>,
  layer: Layer.Layer<FileWriterPort>
): Exit.Exit<A, E> => Effect.runSyncExit(Effect.provide(effect, layer))

describe('createFile', () => {
  it('writes an empty file and returns the validated path on success', () => {
    const created: string[] = []
    const exit = run(createFile('  /notes/draft.md '), writerThatSucceeds(created))

    expect(exit).toStrictEqual(Exit.succeed('/notes/draft.md'))
    expect(created).toStrictEqual(['/notes/draft.md'])
  })

  it('defaults a bare name to a .md file, writing and returning the extended path', () => {
    const created: string[] = []
    const exit = run(createFile('/notes/draft'), writerThatSucceeds(created))

    expect(exit).toStrictEqual(Exit.succeed('/notes/draft.md'))
    expect(created).toStrictEqual(['/notes/draft.md'])
  })

  it('appends .md to a non-markdown extension rather than rejecting it', () => {
    const created: string[] = []
    const exit = run(createFile('/notes/draft.txt'), writerThatSucceeds(created))

    expect(exit).toStrictEqual(Exit.succeed('/notes/draft.txt.md'))
    expect(created).toStrictEqual(['/notes/draft.txt.md'])
  })

  it('fails with InvalidPath when the path is just the extension', () => {
    const exit = run(createFile('.md'), writerThatSucceeds([]))
    expect(exit).toStrictEqual(Exit.fail(expect.objectContaining({ _tag: 'InvalidPath' })))
  })

  it('fails with InvalidPath when the path is blank, without touching the writer', () => {
    const created: string[] = []
    const exit = run(createFile('   '), writerThatSucceeds(created))

    expect(created).toStrictEqual([])
    expect(exit).toStrictEqual(Exit.fail(expect.objectContaining({ _tag: 'InvalidPath' })))
  })

  it('accepts an uppercase .MD extension', () => {
    const created: string[] = []
    const exit = run(createFile('/notes/DRAFT.MD'), writerThatSucceeds(created))
    expect(Exit.isSuccess(exit)).toBe(true)
    expect(created).toStrictEqual(['/notes/DRAFT.MD'])
  })

  it('propagates FileAlreadyExists from the writer', () => {
    const error = new FileAlreadyExists({ path: '/notes/draft.md' })
    const exit = run(createFile('/notes/draft.md'), writerThatFails(error))
    expect(exit).toStrictEqual(Exit.fail(error))
  })

  it('propagates DirectoryNotFound from the writer', () => {
    const error = new DirectoryNotFound({ path: '/missing/draft.md' })
    const exit = run(createFile('/missing/draft.md'), writerThatFails(error))
    expect(exit).toStrictEqual(Exit.fail(error))
  })

  it('propagates FileWriteFailed from the writer', () => {
    const error = new FileWriteFailed({ path: '/notes/draft.md' })
    const exit = run(createFile('/notes/draft.md'), writerThatFails(error))
    expect(exit).toStrictEqual(Exit.fail(error))
  })
})
