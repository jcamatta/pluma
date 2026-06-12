// Command use case: rename a thread, persisting the user-chosen title via the ThreadWriterPort. Mutates
// and returns void (an ack at the IPC boundary); a missing or unwritable thread surfaces as a typed
// ThreadWriteFailed.

import * as Effect from 'effect/Effect'
import type { RenameThreadInput } from '../data/rename-thread-input'
import type { ThreadWriteFailed } from '../error/thread-write-failed'
import { ThreadWriter, type ThreadWriterPort } from '../port/thread-writer.port'

export const renameThread = (
  input: RenameThreadInput
): Effect.Effect<void, ThreadWriteFailed, ThreadWriterPort> =>
  Effect.gen(function* () {
    const writer = yield* ThreadWriter
    yield* writer.renameThread(input)
  })
