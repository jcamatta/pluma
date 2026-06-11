// Port for reading past threads. The query use cases depend on this interface, never on the SDK.
// `listThreads` enumerates the threads stored under a workspace `cwd` (most-recent ordering is the
// adapter's job), and `getThreadHistory` returns the post-compaction message chain the agent would see
// on resume, replayed as the thread's history. Both take the workspace `cwd` so reads resolve against
// the same directory the runs are keyed under. The Claude adapter implements this over the SDK's session
// functions; tests provide an in-memory fake.

import * as Context from 'effect/Context'
import type * as Effect from 'effect/Effect'
import type { Message } from '@ag-ui/core'
import type { ThreadSummary } from '../data/thread-summary'
import type { ThreadReadFailed } from '../error/thread-read-failed'

interface ThreadReaderPort {
  readonly listThreads: (cwd: string) => Effect.Effect<readonly ThreadSummary[], ThreadReadFailed>
  readonly getThreadHistory: (
    cwd: string,
    id: string
  ) => Effect.Effect<readonly Message[], ThreadReadFailed>
}

const ThreadReader = Context.GenericTag<ThreadReaderPort>('application/ThreadReader')

export { ThreadReader, type ThreadReaderPort }
