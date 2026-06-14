// Query use case: read one thread's current context occupancy from its stored session, so the renderer
// can show the context meter on resume — before any new run. Reads through the ThreadReaderPort and
// returns the AgentContextUsage (or null when the thread has no usage yet). Side-effect-free; an
// unreadable thread surfaces as a typed ThreadReadFailed.

import * as Effect from 'effect/Effect'
import type { AgentContextUsage } from '../data/context-usage'
import type { ThreadReadFailed } from '../error/thread-read-failed'
import { ThreadReader, type ThreadReaderPort } from '../port/thread-reader.port'

export const getThreadContext = (
  cwd: string,
  id: string
): Effect.Effect<AgentContextUsage | null, ThreadReadFailed, ThreadReaderPort> =>
  Effect.gen(function* () {
    const reader = yield* ThreadReader
    return yield* reader.getThreadContext(cwd, id)
  })
