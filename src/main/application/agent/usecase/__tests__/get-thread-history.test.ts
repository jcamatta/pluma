// Tests for the getThreadHistory query use case against an in-memory ThreadReader fake. Verifies the
// message chain flows through on success and that a ThreadReadFailed from the port surfaces as the use
// case's typed failure.

import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as Layer from 'effect/Layer'
import { describe, expect, it } from 'vitest'
import type { Message } from '@ag-ui/core'
import { ThreadReadFailed } from '../../error/thread-read-failed'
import { ThreadReader, type ThreadReaderPort } from '../../port/thread-reader.port'
import { getThreadHistory } from '../get-thread-history'

const history: readonly Message[] = [{ id: 'm1', role: 'user', content: 'hi' }]

const readerReturning = (
  result: Effect.Effect<readonly Message[], ThreadReadFailed>
): Layer.Layer<ThreadReaderPort> =>
  Layer.succeed(
    ThreadReader,
    ThreadReader.of({
      listThreads: () => Effect.succeed([]),
      getThreadHistory: () => result
    })
  )

describe('getThreadHistory', () => {
  it('returns the message chain from the reader', () => {
    const exit = Effect.runSyncExit(
      Effect.provide(getThreadHistory('/work', 's1'), readerReturning(Effect.succeed(history)))
    )
    expect(exit).toStrictEqual(Exit.succeed(history))
  })

  it('surfaces a ThreadReadFailed from the reader', () => {
    const failed = new ThreadReadFailed({ cwd: '/work' })
    const exit = Effect.runSyncExit(
      Effect.provide(getThreadHistory('/work', 's1'), readerReturning(Effect.fail(failed)))
    )
    expect(exit).toStrictEqual(Exit.fail(failed))
  })
})
