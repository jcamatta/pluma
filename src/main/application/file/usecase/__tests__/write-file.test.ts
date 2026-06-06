// Tests for the writeFile use case against an in-memory FileWriter fake. Covers the success path,
// the path-validation failure, and each typed failure the port can produce.

import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as Layer from 'effect/Layer'
import { describe, expect, it } from 'vitest'
import { FileNotFound } from '../../error/file-not-found'
import { FileWriteFailed } from '../../error/file-write-failed'
import { writeFile } from '../write-file'
import { FileWriter } from '../../port/file-writer.port'
import type { FileWriterPort } from '../../port/file-writer.port'

const writerThatSucceeds = (written: Array<[string, string]>): Layer.Layer<FileWriterPort> =>
  Layer.succeed(
    FileWriter,
    FileWriter.of({
      createEmptyFile: () => Effect.void,
      deleteFile: () => Effect.void,
      writeFile: (path, content) =>
        Effect.sync(() => {
          written.push([path, content])
        })
    })
  )

const writerThatFails = (error: FileNotFound | FileWriteFailed): Layer.Layer<FileWriterPort> =>
  Layer.succeed(
    FileWriter,
    FileWriter.of({
      createEmptyFile: () => Effect.void,
      deleteFile: () => Effect.void,
      writeFile: () => Effect.fail(error)
    })
  )

const run = <A, E>(
  effect: Effect.Effect<A, E, FileWriterPort>,
  layer: Layer.Layer<FileWriterPort>
): Exit.Exit<A, E> => Effect.runSyncExit(Effect.provide(effect, layer))

describe('writeFile', () => {
  it('writes the content and returns the validated path on success', () => {
    const written: Array<[string, string]> = []
    const exit = run(writeFile('  /notes/draft.md ', '# Hello'), writerThatSucceeds(written))

    expect(exit).toStrictEqual(Exit.succeed('/notes/draft.md'))
    expect(written).toStrictEqual([['/notes/draft.md', '# Hello']])
  })

  it('fails with InvalidPath when the path is not a .md file, without touching the writer', () => {
    const written: Array<[string, string]> = []
    const exit = run(writeFile('/notes/draft.txt', 'x'), writerThatSucceeds(written))

    expect(Exit.isFailure(exit)).toBe(true)
    expect(written).toStrictEqual([])
    expect(exit).toStrictEqual(Exit.fail(expect.objectContaining({ _tag: 'InvalidPath' })))
  })

  it('fails with InvalidPath when the path is just the extension', () => {
    const exit = run(writeFile('.md', 'x'), writerThatSucceeds([]))
    expect(exit).toStrictEqual(Exit.fail(expect.objectContaining({ _tag: 'InvalidPath' })))
  })

  it('accepts an uppercase .MD extension', () => {
    const written: Array<[string, string]> = []
    const exit = run(writeFile('/notes/DRAFT.MD', 'body'), writerThatSucceeds(written))
    expect(Exit.isSuccess(exit)).toBe(true)
    expect(written).toStrictEqual([['/notes/DRAFT.MD', 'body']])
  })

  it('propagates FileNotFound from the writer', () => {
    const error = new FileNotFound({ path: '/notes/draft.md' })
    const exit = run(writeFile('/notes/draft.md', 'x'), writerThatFails(error))
    expect(exit).toStrictEqual(Exit.fail(error))
  })

  it('propagates FileWriteFailed from the writer', () => {
    const error = new FileWriteFailed({ path: '/notes/draft.md' })
    const exit = run(writeFile('/notes/draft.md', 'x'), writerThatFails(error))
    expect(exit).toStrictEqual(Exit.fail(error))
  })
})
