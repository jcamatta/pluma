// Query use case: list the past threads stored under a workspace folder, most-recent first. Reads
// through the ThreadReaderPort and returns the summaries unchanged (the adapter resolves each title and
// ordering). Side-effect-free; failures surface as a typed ThreadReadFailed.

import * as Effect from 'effect/Effect'
import type { ThreadSummary } from '../data/thread-summary'
import type { ThreadReadFailed } from '../error/thread-read-failed'
import { ThreadReader, type ThreadReaderPort } from '../port/thread-reader.port'

export const listThreads = (
  cwd: string
): Effect.Effect<readonly ThreadSummary[], ThreadReadFailed, ThreadReaderPort> =>
  Effect.gen(function* () {
    const reader = yield* ThreadReader
    return yield* reader.listThreads(cwd)
  })
