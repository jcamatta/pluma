// IPC endpoint for loading one thread's message history. Runs the getThreadHistory use case with the
// live Claude reader adapter through the shared runIpc wrapper, which logs the call and serializes the
// Effect outcome into a plain Result. Never throws across IPC.

import type { Message } from '@ag-ui/core'
import * as Effect from 'effect/Effect'
import { AGENT_THREAD_HISTORY_CHANNEL } from '../../../shared/ipc/ipc-contract/agent'
import type { ThreadHistoryInput, ThreadReadError } from '../../../shared/ipc/ipc-contract/agent'
import type { Result } from '../../../shared/ipc/ipc-result'
import { ClaudeThreadReaderLive } from '../../adapters/agent/claude/runtime/claude-thread-reader'
import { getThreadHistory } from '../../application/agent/usecase/get-thread-history'
import { runIpc } from '../shared/run-ipc'

export const handleThreadHistory = (
  input: ThreadHistoryInput
): Promise<Result<readonly Message[], ThreadReadError>> =>
  runIpc({
    channel: AGENT_THREAD_HISTORY_CHANNEL,
    annotations: { cwd: input.cwd, threadId: input.threadId },
    effect: getThreadHistory(input.cwd, input.threadId).pipe(
      Effect.provide(ClaudeThreadReaderLive)
    ),
    onError: (error) => ({ _tag: error._tag }),
    onDefect: () => ({ _tag: 'ThreadReadFailed' })
  })
