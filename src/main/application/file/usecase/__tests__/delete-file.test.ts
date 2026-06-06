// Tests for the deleteFile use case against an in-memory FileWriter fake. Covers the success path,
// the path-validation failure, and each typed failure the port can produce.

import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as Layer from 'effect/Layer'
import { describe, expect, it } from 'vitest'
import { FileNotFound } from '../../error/file-not-found'
import { FileDeleteFailed } from '../../error/file-delete-failed'
import { deleteFile } from '../delete-file'
import { FileWriter } from '../../port/file-writer.port'
import type { FileWriterPort } from '../../port/file-writer.port'

const writerThatSucceeds = (deleted: string[]): Layer.Layer<FileWriterPort> =>
  Layer.succeed(
    FileWriter,
    FileWriter.of({
      createEmptyFile: () => Effect.void,
      deleteFile: (path) =>
        Effect.sync(() => {
          deleted.push(path)
        })
    })
  )

const writerThatFails = (error: FileNotFound | FileDeleteFailed): Layer.Layer<FileWriterPort> =>
  Layer.succeed(
    FileWriter,
    FileWriter.of({
      createEmptyFile: () => Effect.void,
      deleteFile: () => Effect.fail(error)
    })
  )

const run = <A, E>(
  effect: Effect.Effect<A, E, FileWriterPort>,
  layer: Layer.Layer<FileWriterPort>
): Exit.Exit<A, E> => Effect.runSyncExit(Effect.provide(effect, layer))

describe('deleteFile', () => {
  it('deletes the file and returns the validated path on success', () => {
    const deleted: string[] = []
    const exit = run(deleteFile('  /notes/draft.md '), writerThatSucceeds(deleted))

    expect(exit).toStrictEqual(Exit.succeed('/notes/draft.md'))
    expect(deleted).toStrictEqual(['/notes/draft.md'])
  })

  it('fails with InvalidPath when the path is not a .md file, without touching the writer', () => {
    const deleted: string[] = []
    const exit = run(deleteFile('/notes/draft.txt'), writerThatSucceeds(deleted))

    expect(Exit.isFailure(exit)).toBe(true)
    expect(deleted).toStrictEqual([])
    expect(exit).toStrictEqual(Exit.fail(expect.objectContaining({ _tag: 'InvalidPath' })))
  })

  it('fails with InvalidPath when the path is just the extension', () => {
    const exit = run(deleteFile('.md'), writerThatSucceeds([]))
    expect(exit).toStrictEqual(Exit.fail(expect.objectContaining({ _tag: 'InvalidPath' })))
  })

  it('accepts an uppercase .MD extension', () => {
    const deleted: string[] = []
    const exit = run(deleteFile('/notes/DRAFT.MD'), writerThatSucceeds(deleted))
    expect(Exit.isSuccess(exit)).toBe(true)
    expect(deleted).toStrictEqual(['/notes/DRAFT.MD'])
  })

  it('propagates FileNotFound from the writer', () => {
    const error = new FileNotFound({ path: '/notes/draft.md' })
    const exit = run(deleteFile('/notes/draft.md'), writerThatFails(error))
    expect(exit).toStrictEqual(Exit.fail(error))
  })

  it('propagates FileDeleteFailed from the writer', () => {
    const error = new FileDeleteFailed({ path: '/notes/draft.md' })
    const exit = run(deleteFile('/notes/draft.md'), writerThatFails(error))
    expect(exit).toStrictEqual(Exit.fail(error))
  })
})
