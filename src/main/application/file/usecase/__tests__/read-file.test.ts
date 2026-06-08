// Tests for the readFile use case against an in-memory FileReader fake. Covers the success path,
// the path-validation failure, and each typed failure the port can produce.

import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as Layer from 'effect/Layer'
import { describe, expect, it } from 'vitest'
import { FileNotFound } from '../../error/file-not-found'
import { FileReadFailed } from '../../error/file-read-failed'
import { readFile } from '../read-file'
import { FileReader } from '../../port/file-reader.port'
import type { FileReaderPort } from '../../port/file-reader.port'

const readerThatSucceeds = (read: Array<string>, content: string): Layer.Layer<FileReaderPort> =>
  Layer.succeed(
    FileReader,
    FileReader.of({
      readFile: (path) =>
        Effect.sync(() => {
          read.push(path)
          return content
        })
    })
  )

const readerThatFails = (error: FileNotFound | FileReadFailed): Layer.Layer<FileReaderPort> =>
  Layer.succeed(
    FileReader,
    FileReader.of({
      readFile: () => Effect.fail(error)
    })
  )

const run = <A, E>(
  effect: Effect.Effect<A, E, FileReaderPort>,
  layer: Layer.Layer<FileReaderPort>
): Exit.Exit<A, E> => Effect.runSyncExit(Effect.provide(effect, layer))

describe('readFile', () => {
  it('reads from the validated path and returns the content on success', () => {
    const read: Array<string> = []
    const exit = run(readFile('  /notes/draft.md '), readerThatSucceeds(read, '# Hello'))

    expect(exit).toStrictEqual(Exit.succeed('# Hello'))
    expect(read).toStrictEqual(['/notes/draft.md'])
  })

  it('fails with InvalidPath when the path is not a .md file, without touching the reader', () => {
    const read: Array<string> = []
    const exit = run(readFile('/notes/draft.txt'), readerThatSucceeds(read, 'x'))

    expect(Exit.isFailure(exit)).toBe(true)
    expect(read).toStrictEqual([])
    expect(exit).toStrictEqual(Exit.fail(expect.objectContaining({ _tag: 'InvalidPath' })))
  })

  it('fails with InvalidPath when the path is just the extension', () => {
    const exit = run(readFile('.md'), readerThatSucceeds([], 'x'))
    expect(exit).toStrictEqual(Exit.fail(expect.objectContaining({ _tag: 'InvalidPath' })))
  })

  it('accepts an uppercase .MD extension', () => {
    const read: Array<string> = []
    const exit = run(readFile('/notes/DRAFT.MD'), readerThatSucceeds(read, 'body'))
    expect(exit).toStrictEqual(Exit.succeed('body'))
    expect(read).toStrictEqual(['/notes/DRAFT.MD'])
  })

  it('propagates FileNotFound from the reader', () => {
    const error = new FileNotFound({ path: '/notes/draft.md' })
    const exit = run(readFile('/notes/draft.md'), readerThatFails(error))
    expect(exit).toStrictEqual(Exit.fail(error))
  })

  it('propagates FileReadFailed from the reader', () => {
    const error = new FileReadFailed({ path: '/notes/draft.md' })
    const exit = run(readFile('/notes/draft.md'), readerThatFails(error))
    expect(exit).toStrictEqual(Exit.fail(error))
  })
})
