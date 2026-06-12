// IPC endpoint for deleting a thread. Runs the deleteThread use case with the live Claude writer adapter
// through the shared runIpc wrapper, which logs the call and serializes the Effect outcome into a plain
// ack Result. Never throws across IPC.

import * as Effect from 'effect/Effect'
import { AGENT_DELETE_THREAD_CHANNEL } from '../../../shared/ipc/ipc-contract/agent'
import type { DeleteThreadRequest, ThreadWriteError } from '../../../shared/ipc/ipc-contract/agent'
import type { Result } from '../../../shared/ipc/ipc-result'
import { ClaudeThreadWriterLive } from '../../adapters/agent/claude/runtime/claude-thread-writer'
import { deleteThread } from '../../application/agent/usecase/delete-thread'
import { runIpc } from '../shared/run-ipc'

export const handleDeleteThread = (
  request: DeleteThreadRequest
): Promise<Result<null, ThreadWriteError>> =>
  runIpc({
    channel: AGENT_DELETE_THREAD_CHANNEL,
    annotations: { cwd: request.cwd, threadId: request.threadId },
    effect: deleteThread(request.cwd, request.threadId).pipe(
      Effect.provide(ClaudeThreadWriterLive),
      Effect.as(null)
    ),
    onError: (error) => ({ _tag: error._tag }),
    onDefect: () => ({ _tag: 'ThreadWriteFailed' })
  })
