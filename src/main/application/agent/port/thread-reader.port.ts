// Port for reading past threads. The query use cases depend on this interface, never on the SDK.
// `listThreads` enumerates the threads stored under a workspace `cwd` (most-recent ordering is the
// adapter's job), and `getThreadHistory` returns the post-compaction message chain the agent would see
// on resume, replayed as the thread's history. Both take the workspace `cwd` so reads resolve against
// the same directory the runs are keyed under. The Claude adapter implements this over the SDK's session
// functions; tests provide an in-memory fake.

import * as Context from 'effect/Context'
import type * as Effect from 'effect/Effect'
import type { Message } from '@ag-ui/core'
import type { AgentContextUsage } from '../data/context-usage'
import type { ThreadSummary } from '../data/thread-summary'
import type { ThreadReadFailed } from '../error/thread-read-failed'

interface ThreadReaderPort {
  readonly listThreads: (cwd: string) => Effect.Effect<readonly ThreadSummary[], ThreadReadFailed>
  readonly getThreadHistory: (
    cwd: string,
    id: string
  ) => Effect.Effect<readonly Message[], ThreadReadFailed>
  // The thread's current context occupancy (null when no assistant turn has reported usage), read from
  // the stored session so the meter shows on resume before any new run.
  readonly getThreadContext: (
    cwd: string,
    id: string
  ) => Effect.Effect<AgentContextUsage | null, ThreadReadFailed>
}

const ThreadReader = Context.GenericTag<ThreadReaderPort>('application/ThreadReader')

export { ThreadReader, type ThreadReaderPort }
