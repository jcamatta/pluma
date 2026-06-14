// IPC endpoint for reading one thread's current context occupancy (for the meter on resume). Runs the
// getThreadContext use case with the live Claude reader adapter through runIpc, which logs the call and
// serializes the Effect outcome into a plain Result. Never throws across IPC.

import * as Effect from 'effect/Effect'
import type { AgentContextUsage } from '../../../shared/agent/context-usage'
import { AGENT_THREAD_CONTEXT_CHANNEL } from '../../../shared/ipc/ipc-contract/agent'
import type { ThreadContextInput, ThreadReadError } from '../../../shared/ipc/ipc-contract/agent'
import type { Result } from '../../../shared/ipc/ipc-result'
import { ClaudeThreadReaderLive } from '../../adapters/agent/claude/runtime/claude-thread-reader'
import { getThreadContext } from '../../application/agent/usecase/get-thread-context'
import { runIpc } from '../shared/run-ipc'

export const handleThreadContext = (
  input: ThreadContextInput
): Promise<Result<AgentContextUsage | null, ThreadReadError>> =>
  runIpc({
    channel: AGENT_THREAD_CONTEXT_CHANNEL,
    annotations: { cwd: input.cwd, threadId: input.threadId },
    effect: getThreadContext(input.cwd, input.threadId).pipe(
      Effect.provide(ClaudeThreadReaderLive)
    ),
    onError: (error) => ({ _tag: error._tag }),
    onDefect: () => ({ _tag: 'ThreadReadFailed' })
  })
