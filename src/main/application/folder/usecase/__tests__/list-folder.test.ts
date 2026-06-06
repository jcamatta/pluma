// Tests for the listFolder use case against an in-memory FolderReader fake. Covers the success path,
// the folder-path validation rules, and each typed failure the port can produce.

import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as Layer from 'effect/Layer'
import { describe, expect, it } from 'vitest'
import type { FolderEntry } from '../../data/entry'
import { FolderNotFound } from '../../error/folder-not-found'
import { FolderReadFailed } from '../../error/folder-read-failed'
import { listFolder } from '../list-folder'
import { FolderReader } from '../../port/folder-reader.port'
import type { FolderReaderPort } from '../../port/folder-reader.port'

const readerThatReturns = (
  entries: ReadonlyArray<FolderEntry>,
  listed: string[]
): Layer.Layer<FolderReaderPort> =>
  Layer.succeed(
    FolderReader,
    FolderReader.of({
      listFolder: (path) =>
        Effect.sync(() => {
          listed.push(path)
          return entries
        })
    })
  )

const readerThatFails = (error: FolderNotFound | FolderReadFailed): Layer.Layer<FolderReaderPort> =>
  Layer.succeed(
    FolderReader,
    FolderReader.of({
      listFolder: () => Effect.fail(error)
    })
  )

const run = <A, E>(
  effect: Effect.Effect<A, E, FolderReaderPort>,
  layer: Layer.Layer<FolderReaderPort>
): Exit.Exit<A, E> => Effect.runSyncExit(Effect.provide(effect, layer))

describe('listFolder', () => {
  it('lists the folder and returns its entries on the validated path', () => {
    const listed: string[] = []
    const entries: ReadonlyArray<FolderEntry> = [
      { name: 'ideas', type: 'directory' },
      { name: 'todo.md', type: 'file' }
    ]
    const exit = run(listFolder('  /notes '), readerThatReturns(entries, listed))

    expect(exit).toStrictEqual(Exit.succeed(entries))
    expect(listed).toStrictEqual(['/notes'])
  })

  it('fails with InvalidFolderPath when the path is empty, without touching the reader', () => {
    const listed: string[] = []
    const exit = run(listFolder('   '), readerThatReturns([], listed))

    expect(Exit.isFailure(exit)).toBe(true)
    expect(listed).toStrictEqual([])
    expect(exit).toStrictEqual(Exit.fail(expect.objectContaining({ _tag: 'InvalidFolderPath' })))
  })

  it('propagates FolderNotFound from the reader', () => {
    const error = new FolderNotFound({ path: '/notes' })
    const exit = run(listFolder('/notes'), readerThatFails(error))
    expect(exit).toStrictEqual(Exit.fail(error))
  })

  it('propagates FolderReadFailed from the reader', () => {
    const error = new FolderReadFailed({ path: '/notes' })
    const exit = run(listFolder('/notes'), readerThatFails(error))
    expect(exit).toStrictEqual(Exit.fail(error))
  })
})
