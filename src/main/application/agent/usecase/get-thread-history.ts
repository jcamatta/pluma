// Query use case: load one thread's message history so the renderer can replay it and resume the
// session. Reads through the ThreadReaderPort, which returns the post-compaction message chain (the same
// view the agent sees on resume). Side-effect-free; a missing or unreadable thread surfaces as a typed
// ThreadReadFailed.

import * as Effect from 'effect/Effect'
import type { Message } from '@ag-ui/core'
import type { ThreadReadFailed } from '../error/thread-read-failed'
import { ThreadReader, type ThreadReaderPort } from '../port/thread-reader.port'

export const getThreadHistory = (
  cwd: string,
  id: string
): Effect.Effect<readonly Message[], ThreadReadFailed, ThreadReaderPort> =>
  Effect.gen(function* () {
    const reader = yield* ThreadReader
    return yield* reader.getThreadHistory(cwd, id)
  })
