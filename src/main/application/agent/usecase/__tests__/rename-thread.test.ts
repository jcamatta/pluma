// Tests for the renameThread command use case against an in-memory ThreadWriter fake. Verifies the
// rename is delegated to the port with the given input and that a ThreadWriteFailed surfaces as the use
// case's typed failure.

import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as Layer from 'effect/Layer'
import { describe, expect, it } from 'vitest'
import type { RenameThreadInput } from '../../data/rename-thread-input'
import { ThreadWriteFailed } from '../../error/thread-write-failed'
import { ThreadWriter, type ThreadWriterPort } from '../../port/thread-writer.port'
import { renameThread } from '../rename-thread'

const writerFake = (
  renamed: RenameThreadInput[],
  result: Effect.Effect<void, ThreadWriteFailed>
): Layer.Layer<ThreadWriterPort> =>
  Layer.succeed(
    ThreadWriter,
    ThreadWriter.of({
      renameThread: (input) =>
        Effect.sync(() => {
          renamed.push(input)
        }).pipe(Effect.zipRight(result)),
      deleteThread: () => Effect.void
    })
  )

const input: RenameThreadInput = { cwd: '/work', id: 's1', title: 'Renamed' }

describe('renameThread', () => {
  it('delegates the rename to the writer', () => {
    const renamed: RenameThreadInput[] = []
    const exit = Effect.runSyncExit(
      Effect.provide(renameThread(input), writerFake(renamed, Effect.void))
    )
    expect(exit).toStrictEqual(Exit.succeed(undefined))
    expect(renamed).toStrictEqual([input])
  })

  it('surfaces a ThreadWriteFailed from the writer', () => {
    const failed = new ThreadWriteFailed({ cwd: '/work' })
    const exit = Effect.runSyncExit(
      Effect.provide(renameThread(input), writerFake([], Effect.fail(failed)))
    )
    expect(exit).toStrictEqual(Exit.fail(failed))
  })
})
