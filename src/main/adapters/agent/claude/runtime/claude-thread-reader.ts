// ThreadReader adapter backed by the Claude Agent SDK. The only read place that touches the SDK's
// session store. `listThreads` enumerates the sessions under the workspace `dir` and maps each to a
// ThreadSummary (most-recent first); `getThreadHistory` loads one session's post-compaction message
// chain and maps it to AG-UI Messages. Both pass the workspace `cwd` as the SDK's `dir` so reads resolve
// against the same directory the runs are keyed under, and convert any SDK failure to a ThreadReadFailed.

import { getSessionMessages, listSessions } from '@anthropic-ai/claude-agent-sdk'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import type { Message } from '@ag-ui/core'
import type { ThreadSummary } from '../../../../application/agent/data/thread-summary'
import { ThreadReadFailed } from '../../../../application/agent/error/thread-read-failed'
import { ThreadReader } from '../../../../application/agent/port/thread-reader.port'
import { sessionInfoToSummary } from '../logic/session-info-to-summary'
import { sessionMessagesToHistory } from '../logic/session-messages-to-history'

const listThreads = (cwd: string): Effect.Effect<readonly ThreadSummary[], ThreadReadFailed> =>
  Effect.tryPromise({
    try: () => listSessions({ dir: cwd }),
    catch: () => new ThreadReadFailed({ cwd })
  }).pipe(
    Effect.map((sessions) =>
      sessions.map(sessionInfoToSummary).sort((a, b) => b.updatedAt - a.updatedAt)
    )
  )

const getThreadHistory = (
  cwd: string,
  id: string
): Effect.Effect<readonly Message[], ThreadReadFailed> =>
  Effect.tryPromise({
    try: () => getSessionMessages(id, { dir: cwd }),
    catch: () => new ThreadReadFailed({ cwd })
  }).pipe(Effect.map(sessionMessagesToHistory))

export const ClaudeThreadReaderLive = Layer.succeed(
  ThreadReader,
  ThreadReader.of({ listThreads, getThreadHistory })
)
