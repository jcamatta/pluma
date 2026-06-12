// IPC endpoint for renaming a thread. Runs the renameThread use case with the live Claude writer
// adapter, then serializes the Effect outcome into a plain ack Result. Never throws across IPC.

import * as Cause from 'effect/Cause'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import type { RenameThreadRequest, ThreadWriteError } from '../../../shared/ipc/ipc-contract/agent'
import type { Result } from '../../../shared/ipc/ipc-result'
import { ClaudeThreadWriterLive } from '../../adapters/agent/claude/runtime/claude-thread-writer'
import { renameThread } from '../../application/agent/usecase/rename-thread'

export const handleRenameThread = (
  request: RenameThreadRequest
): Promise<Result<null, ThreadWriteError>> => {
  const program = renameThread({
    cwd: request.cwd,
    id: request.threadId,
    title: request.title
  }).pipe(Effect.provide(ClaudeThreadWriterLive))

  return Effect.runPromiseExit(program).then(
    (exit): Result<null, ThreadWriteError> =>
      Exit.match(exit, {
        onSuccess: () => ({ ok: true, value: null }),
        onFailure: (cause) => {
          const error = Cause.failureOption(cause)
          return error._tag === 'Some'
            ? { ok: false, error: { _tag: error.value._tag } }
            : { ok: false, error: { _tag: 'ThreadWriteFailed' } }
        }
      })
  )
}
