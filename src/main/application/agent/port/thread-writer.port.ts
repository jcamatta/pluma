// Port for mutating past threads. The command use cases depend on this interface, never on the SDK.
// `renameThread` stores a user-chosen name for a thread (which then wins over the derived title on read)
// and `deleteThread` removes the session from disk. Both target the workspace `cwd` the session is keyed
// under, so writes hit the same directory the reader lists. Kept separate from the reader port per CQS.
// The Claude adapter implements this over the SDK's rename/delete session functions; tests provide an
// in-memory fake.

import * as Context from 'effect/Context'
import type * as Effect from 'effect/Effect'
import type { RenameThreadInput } from '../data/rename-thread-input'
import type { ThreadWriteFailed } from '../error/thread-write-failed'

interface ThreadWriterPort {
  readonly renameThread: (input: RenameThreadInput) => Effect.Effect<void, ThreadWriteFailed>
  readonly deleteThread: (cwd: string, id: string) => Effect.Effect<void, ThreadWriteFailed>
}

const ThreadWriter = Context.GenericTag<ThreadWriterPort>('application/ThreadWriter')

export { ThreadWriter, type ThreadWriterPort }
