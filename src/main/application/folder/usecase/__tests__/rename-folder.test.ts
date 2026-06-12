// Tests for the renameFolder use case against an in-memory FolderWriter fake. Covers the success
// path, the folder-path validation rules for both paths, and each typed failure the port can produce.

import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as Layer from 'effect/Layer'
import { describe, expect, it } from 'vitest'
import { FolderNotFound } from '../../error/folder-not-found'
import { FolderAlreadyExists } from '../../error/folder-already-exists'
import { FolderRenameFailed } from '../../error/folder-rename-failed'
import { renameFolder } from '../rename-folder'
import { FolderWriter } from '../../port/folder-writer.port'
import type { FolderWriterPort } from '../../port/folder-writer.port'

const writerThatSucceeds = (
  renamed: Array<readonly [string, string]>
): Layer.Layer<FolderWriterPort> =>
  Layer.succeed(
    FolderWriter,
    FolderWriter.of({
      createFolder: () => Effect.void,
      deleteFolder: () => Effect.void,
      renameFolder: (oldPath, newPath) =>
        Effect.sync(() => {
          renamed.push([oldPath, newPath])
        })
    })
  )

const writerThatFails = (
  error: FolderNotFound | FolderAlreadyExists | FolderRenameFailed
): Layer.Layer<FolderWriterPort> =>
  Layer.succeed(
    FolderWriter,
    FolderWriter.of({
      createFolder: () => Effect.void,
      deleteFolder: () => Effect.void,
      renameFolder: () => Effect.fail(error)
    })
  )

const run = <A, E>(
  effect: Effect.Effect<A, E, FolderWriterPort>,
  layer: Layer.Layer<FolderWriterPort>
): Exit.Exit<A, E> => Effect.runSyncExit(Effect.provide(effect, layer))

describe('renameFolder', () => {
  it('renames the folder and returns the validated new path on success', () => {
    const renamed: Array<readonly [string, string]> = []
    const exit = run(renameFolder('  /notes/old ', ' /notes/new '), writerThatSucceeds(renamed))

    expect(exit).toStrictEqual(Exit.succeed('/notes/new'))
    expect(renamed).toStrictEqual([['/notes/old', '/notes/new']])
  })

  it('fails with InvalidFolderPath when the old path is empty, without touching the writer', () => {
    const renamed: Array<readonly [string, string]> = []
    const exit = run(renameFolder('   ', '/notes/new'), writerThatSucceeds(renamed))

    expect(Exit.isFailure(exit)).toBe(true)
    expect(renamed).toStrictEqual([])
    expect(exit).toStrictEqual(Exit.fail(expect.objectContaining({ _tag: 'InvalidFolderPath' })))
  })

  it('fails with InvalidFolderPath when the new path is empty, without touching the writer', () => {
    const renamed: Array<readonly [string, string]> = []
    const exit = run(renameFolder('/notes/old', '   '), writerThatSucceeds(renamed))

    expect(Exit.isFailure(exit)).toBe(true)
    expect(renamed).toStrictEqual([])
    expect(exit).toStrictEqual(Exit.fail(expect.objectContaining({ _tag: 'InvalidFolderPath' })))
  })

  it('propagates FolderNotFound from the writer', () => {
    const error = new FolderNotFound({ path: '/notes/old' })
    const exit = run(renameFolder('/notes/old', '/notes/new'), writerThatFails(error))
    expect(exit).toStrictEqual(Exit.fail(error))
  })

  it('propagates FolderAlreadyExists from the writer', () => {
    const error = new FolderAlreadyExists({ path: '/notes/new' })
    const exit = run(renameFolder('/notes/old', '/notes/new'), writerThatFails(error))
    expect(exit).toStrictEqual(Exit.fail(error))
  })

  it('propagates FolderRenameFailed from the writer', () => {
    const error = new FolderRenameFailed({ path: '/notes/new' })
    const exit = run(renameFolder('/notes/old', '/notes/new'), writerThatFails(error))
    expect(exit).toStrictEqual(Exit.fail(error))
  })
})
