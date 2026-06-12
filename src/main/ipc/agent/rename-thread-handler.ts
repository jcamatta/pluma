// IPC endpoint for renaming a thread. Runs the renameThread use case with the live Claude writer adapter
// through the shared runIpc wrapper, which logs the call and serializes the Effect outcome into a plain
// ack Result. The title is not annotated (it is user content) — only cwd and thread id. Never throws.

import * as Effect from 'effect/Effect'
import { AGENT_RENAME_THREAD_CHANNEL } from '../../../shared/ipc/ipc-contract/agent'
import type { RenameThreadRequest, ThreadWriteError } from '../../../shared/ipc/ipc-contract/agent'
import type { Result } from '../../../shared/ipc/ipc-result'
import { ClaudeThreadWriterLive } from '../../adapters/agent/claude/runtime/claude-thread-writer'
import { renameThread } from '../../application/agent/usecase/rename-thread'
import { runIpc } from '../shared/run-ipc'

export const handleRenameThread = (
  request: RenameThreadRequest
): Promise<Result<null, ThreadWriteError>> =>
  runIpc({
    channel: AGENT_RENAME_THREAD_CHANNEL,
    annotations: { cwd: request.cwd, threadId: request.threadId },
    effect: renameThread({
      cwd: request.cwd,
      id: request.threadId,
      title: request.title
    }).pipe(Effect.provide(ClaudeThreadWriterLive), Effect.as(null)),
    onError: (error) => ({ _tag: error._tag }),
    onDefect: () => ({ _tag: 'ThreadWriteFailed' })
  })
