// Tests for the listThreads query use case against an in-memory ThreadReader fake. Verifies the
// summaries flow through unchanged on success and that a ThreadReadFailed from the port surfaces as the
// use case's typed failure.

import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as Layer from 'effect/Layer'
import { describe, expect, it } from 'vitest'
import { ThreadReadFailed } from '../../error/thread-read-failed'
import { ThreadReader, type ThreadReaderPort } from '../../port/thread-reader.port'
import type { ThreadSummary } from '../../data/thread-summary'
import { listThreads } from '../list-threads'

const summaries: readonly ThreadSummary[] = [
  { id: 's1', title: 'First', updatedAt: 2 },
  { id: 's2', title: 'Second', updatedAt: 1 }
]

const readerReturning = (
  result: Effect.Effect<readonly ThreadSummary[], ThreadReadFailed>
): Layer.Layer<ThreadReaderPort> =>
  Layer.succeed(
    ThreadReader,
    ThreadReader.of({
      listThreads: () => result,
      getThreadHistory: () => Effect.succeed([]),
      getThreadContext: () => Effect.succeed(null)
    })
  )

describe('listThreads', () => {
  it('returns the summaries from the reader', () => {
    const exit = Effect.runSyncExit(
      Effect.provide(listThreads('/work'), readerReturning(Effect.succeed(summaries)))
    )
    expect(exit).toStrictEqual(Exit.succeed(summaries))
  })

  it('surfaces a ThreadReadFailed from the reader', () => {
    const failed = new ThreadReadFailed({ cwd: '/work' })
    const exit = Effect.runSyncExit(
      Effect.provide(listThreads('/work'), readerReturning(Effect.fail(failed)))
    )
    expect(exit).toStrictEqual(Exit.fail(failed))
  })
})
