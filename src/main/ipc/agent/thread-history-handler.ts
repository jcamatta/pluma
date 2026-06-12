// IPC endpoint for loading one thread's message history. Runs the getThreadHistory use case with the
// live Claude reader adapter, then serializes the Effect outcome into a plain Result. Never throws
// across IPC.

import type { Message } from '@ag-ui/core'
import * as Cause from 'effect/Cause'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import type { ThreadHistoryInput, ThreadReadError } from '../../../shared/ipc/ipc-contract/agent'
import type { Result } from '../../../shared/ipc/ipc-result'
import { ClaudeThreadReaderLive } from '../../adapters/agent/claude/runtime/claude-thread-reader'
import { getThreadHistory } from '../../application/agent/usecase/get-thread-history'

export const handleThreadHistory = (
  input: ThreadHistoryInput
): Promise<Result<readonly Message[], ThreadReadError>> => {
  const program = getThreadHistory(input.cwd, input.threadId).pipe(
    Effect.provide(ClaudeThreadReaderLive)
  )

  return Effect.runPromiseExit(program).then(
    (exit): Result<readonly Message[], ThreadReadError> =>
      Exit.match(exit, {
        onSuccess: (value) => ({ ok: true, value }),
        onFailure: (cause) => {
          const error = Cause.failureOption(cause)
          return error._tag === 'Some'
            ? { ok: false, error: { _tag: error.value._tag } }
            : { ok: false, error: { _tag: 'ThreadReadFailed' } }
        }
      })
  )
}
