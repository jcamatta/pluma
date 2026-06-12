// Tests for the createFolder use case against an in-memory FolderWriter fake. Covers the success
// path, the folder-path validation rules, and each typed failure the port can produce.

import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as Layer from 'effect/Layer'
import { describe, expect, it } from 'vitest'
import { FolderAlreadyExists } from '../../error/folder-already-exists'
import { ParentDirectoryNotFound } from '../../error/parent-directory-not-found'
import { FolderCreationFailed } from '../../error/folder-creation-failed'
import { createFolder } from '../create-folder'
import { FolderWriter } from '../../port/folder-writer.port'
import type { FolderWriterPort } from '../../port/folder-writer.port'

const writerThatSucceeds = (created: string[]): Layer.Layer<FolderWriterPort> =>
  Layer.succeed(
    FolderWriter,
    FolderWriter.of({
      createFolder: (path) =>
        Effect.sync(() => {
          created.push(path)
        }),
      deleteFolder: () => Effect.void,
      renameFolder: () => Effect.void
    })
  )

const writerThatFails = (
  error: FolderAlreadyExists | ParentDirectoryNotFound | FolderCreationFailed
): Layer.Layer<FolderWriterPort> =>
  Layer.succeed(
    FolderWriter,
    FolderWriter.of({
      createFolder: () => Effect.fail(error),
      deleteFolder: () => Effect.void,
      renameFolder: () => Effect.void
    })
  )

const run = <A, E>(
  effect: Effect.Effect<A, E, FolderWriterPort>,
  layer: Layer.Layer<FolderWriterPort>
): Exit.Exit<A, E> => Effect.runSyncExit(Effect.provide(effect, layer))

describe('createFolder', () => {
  it('creates the folder and returns the validated path on success', () => {
    const created: string[] = []
    const exit = run(createFolder('  /notes/drafts '), writerThatSucceeds(created))

    expect(exit).toStrictEqual(Exit.succeed('/notes/drafts'))
    expect(created).toStrictEqual(['/notes/drafts'])
  })

  it('fails with InvalidFolderPath when the path is empty, without touching the writer', () => {
    const created: string[] = []
    const exit = run(createFolder('   '), writerThatSucceeds(created))

    expect(Exit.isFailure(exit)).toBe(true)
    expect(created).toStrictEqual([])
    expect(exit).toStrictEqual(Exit.fail(expect.objectContaining({ _tag: 'InvalidFolderPath' })))
  })

  it('propagates FolderAlreadyExists from the writer', () => {
    const error = new FolderAlreadyExists({ path: '/notes/drafts' })
    const exit = run(createFolder('/notes/drafts'), writerThatFails(error))
    expect(exit).toStrictEqual(Exit.fail(error))
  })

  it('propagates ParentDirectoryNotFound from the writer', () => {
    const error = new ParentDirectoryNotFound({ path: '/missing/drafts' })
    const exit = run(createFolder('/missing/drafts'), writerThatFails(error))
    expect(exit).toStrictEqual(Exit.fail(error))
  })

  it('propagates FolderCreationFailed from the writer', () => {
    const error = new FolderCreationFailed({ path: '/notes/drafts' })
    const exit = run(createFolder('/notes/drafts'), writerThatFails(error))
    expect(exit).toStrictEqual(Exit.fail(error))
  })
})
