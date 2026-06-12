// Tests for the deleteFolder use case against an in-memory FolderWriter fake. Covers the success
// path, the folder-path validation rules, and each typed failure the port can produce.

import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as Layer from 'effect/Layer'
import { describe, expect, it } from 'vitest'
import { FolderNotFound } from '../../error/folder-not-found'
import { FolderDeleteFailed } from '../../error/folder-delete-failed'
import { deleteFolder } from '../delete-folder'
import { FolderWriter } from '../../port/folder-writer.port'
import type { FolderWriterPort } from '../../port/folder-writer.port'

const writerThatSucceeds = (deleted: string[]): Layer.Layer<FolderWriterPort> =>
  Layer.succeed(
    FolderWriter,
    FolderWriter.of({
      createFolder: () => Effect.void,
      deleteFolder: (path) =>
        Effect.sync(() => {
          deleted.push(path)
        }),
      renameFolder: () => Effect.void
    })
  )

const writerThatFails = (
  error: FolderNotFound | FolderDeleteFailed
): Layer.Layer<FolderWriterPort> =>
  Layer.succeed(
    FolderWriter,
    FolderWriter.of({
      createFolder: () => Effect.void,
      deleteFolder: () => Effect.fail(error),
      renameFolder: () => Effect.void
    })
  )

const run = <A, E>(
  effect: Effect.Effect<A, E, FolderWriterPort>,
  layer: Layer.Layer<FolderWriterPort>
): Exit.Exit<A, E> => Effect.runSyncExit(Effect.provide(effect, layer))

describe('deleteFolder', () => {
  it('deletes the folder and returns the validated path on success', () => {
    const deleted: string[] = []
    const exit = run(deleteFolder('  /notes/drafts '), writerThatSucceeds(deleted))

    expect(exit).toStrictEqual(Exit.succeed('/notes/drafts'))
    expect(deleted).toStrictEqual(['/notes/drafts'])
  })

  it('fails with InvalidFolderPath when the path is empty, without touching the writer', () => {
    const deleted: string[] = []
    const exit = run(deleteFolder('   '), writerThatSucceeds(deleted))

    expect(Exit.isFailure(exit)).toBe(true)
    expect(deleted).toStrictEqual([])
    expect(exit).toStrictEqual(Exit.fail(expect.objectContaining({ _tag: 'InvalidFolderPath' })))
  })

  it('propagates FolderNotFound from the writer', () => {
    const error = new FolderNotFound({ path: '/notes/drafts' })
    const exit = run(deleteFolder('/notes/drafts'), writerThatFails(error))
    expect(exit).toStrictEqual(Exit.fail(error))
  })

  it('propagates FolderDeleteFailed from the writer', () => {
    const error = new FolderDeleteFailed({ path: '/notes/drafts' })
    const exit = run(deleteFolder('/notes/drafts'), writerThatFails(error))
    expect(exit).toStrictEqual(Exit.fail(error))
  })
})
