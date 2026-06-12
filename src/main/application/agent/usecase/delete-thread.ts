// Command use case: delete a thread, removing its session from disk via the ThreadWriterPort. Mutates
// and returns void (an ack at the IPC boundary); a missing or unwritable thread surfaces as a typed
// ThreadWriteFailed.

import * as Effect from 'effect/Effect'
import type { ThreadWriteFailed } from '../error/thread-write-failed'
import { ThreadWriter, type ThreadWriterPort } from '../port/thread-writer.port'

export const deleteThread = (
  cwd: string,
  id: string
): Effect.Effect<void, ThreadWriteFailed, ThreadWriterPort> =>
  Effect.gen(function* () {
    const writer = yield* ThreadWriter
    yield* writer.deleteThread(cwd, id)
  })
