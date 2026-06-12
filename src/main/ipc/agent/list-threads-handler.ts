// IPC endpoint for listing the workspace's past threads. Runs the listThreads use case with the live
// Claude reader adapter through the shared runIpc wrapper, which logs the call and serializes the Effect
// outcome into a plain Result. Never throws across IPC.

import * as Effect from 'effect/Effect'
import { AGENT_LIST_THREADS_CHANNEL } from '../../../shared/ipc/ipc-contract/agent'
import type { ThreadReadError, ThreadSummary } from '../../../shared/ipc/ipc-contract/agent'
import type { Result } from '../../../shared/ipc/ipc-result'
import { ClaudeThreadReaderLive } from '../../adapters/agent/claude/runtime/claude-thread-reader'
import { listThreads } from '../../application/agent/usecase/list-threads'
import { runIpc } from '../shared/run-ipc'

export const handleListThreads = (
  cwd: string
): Promise<Result<readonly ThreadSummary[], ThreadReadError>> =>
  runIpc({
    channel: AGENT_LIST_THREADS_CHANNEL,
    annotations: { cwd },
    effect: listThreads(cwd).pipe(Effect.provide(ClaudeThreadReaderLive)),
    onError: (error) => ({ _tag: error._tag }),
    onDefect: () => ({ _tag: 'ThreadReadFailed' })
  })
