// Tests for the getThreadContext query use case against an in-memory ThreadReader fake. Verifies the
// usage (or null) flows through on success and that a ThreadReadFailed from the port surfaces as the use
// case's typed failure.

import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as Layer from 'effect/Layer'
import { describe, expect, it } from 'vitest'
import type { AgentContextUsage } from '../../data/context-usage'
import { ThreadReadFailed } from '../../error/thread-read-failed'
import { ThreadReader, type ThreadReaderPort } from '../../port/thread-reader.port'
import { getThreadContext } from '../get-thread-context'

const usage: AgentContextUsage = {
  usedTokens: 60_000,
  windowTokens: 1_000_000,
  breakdown: { inputTokens: 5000, cacheReadTokens: 55_000, cacheCreationTokens: 0 }
}

const readerReturning = (
  result: Effect.Effect<AgentContextUsage | null, ThreadReadFailed>
): Layer.Layer<ThreadReaderPort> =>
  Layer.succeed(
    ThreadReader,
    ThreadReader.of({
      listThreads: () => Effect.succeed([]),
      getThreadHistory: () => Effect.succeed([]),
      getThreadContext: () => result
    })
  )

describe('getThreadContext', () => {
  it('returns the usage from the reader', () => {
    const exit = Effect.runSyncExit(
      Effect.provide(getThreadContext('/work', 's1'), readerReturning(Effect.succeed(usage)))
    )
    expect(exit).toStrictEqual(Exit.succeed(usage))
  })

  it('returns null when the thread has no usage yet', () => {
    const exit = Effect.runSyncExit(
      Effect.provide(getThreadContext('/work', 's1'), readerReturning(Effect.succeed(null)))
    )
    expect(exit).toStrictEqual(Exit.succeed(null))
  })

  it('surfaces a ThreadReadFailed from the reader', () => {
    const failed = new ThreadReadFailed({ cwd: '/work' })
    const exit = Effect.runSyncExit(
      Effect.provide(getThreadContext('/work', 's1'), readerReturning(Effect.fail(failed)))
    )
    expect(exit).toStrictEqual(Exit.fail(failed))
  })
})
