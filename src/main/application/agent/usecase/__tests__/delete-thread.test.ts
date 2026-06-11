// Tests for the deleteThread command use case against an in-memory ThreadWriter fake. Verifies the
// delete is delegated to the port with the given cwd/id and that a ThreadWriteFailed surfaces as the use
// case's typed failure.

import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as Layer from 'effect/Layer'
import { describe, expect, it } from 'vitest'
import { ThreadWriteFailed } from '../../error/thread-write-failed'
import { ThreadWriter, type ThreadWriterPort } from '../../port/thread-writer.port'
import { deleteThread } from '../delete-thread'

const writerFake = (
  deleted: string[],
  result: Effect.Effect<void, ThreadWriteFailed>
): Layer.Layer<ThreadWriterPort> =>
  Layer.succeed(
    ThreadWriter,
    ThreadWriter.of({
      renameThread: () => Effect.void,
      deleteThread: (_cwd, id) =>
        Effect.sync(() => {
          deleted.push(id)
        }).pipe(Effect.zipRight(result))
    })
  )

describe('deleteThread', () => {
  it('delegates the delete to the writer', () => {
    const deleted: string[] = []
    const exit = Effect.runSyncExit(
      Effect.provide(deleteThread('/work', 's1'), writerFake(deleted, Effect.void))
    )
    expect(exit).toStrictEqual(Exit.succeed(undefined))
    expect(deleted).toStrictEqual(['s1'])
  })

  it('surfaces a ThreadWriteFailed from the writer', () => {
    const failed = new ThreadWriteFailed({ reason: 'missing' })
    const exit = Effect.runSyncExit(
      Effect.provide(deleteThread('/work', 's1'), writerFake([], Effect.fail(failed)))
    )
    expect(exit).toStrictEqual(Exit.fail(failed))
  })
})
