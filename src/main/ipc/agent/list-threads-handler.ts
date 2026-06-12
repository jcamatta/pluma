// IPC endpoint for listing the workspace's past threads. Runs the listThreads use case with the live
// Claude reader adapter, then serializes the Effect outcome into a plain Result. Never throws across IPC.

import * as Cause from 'effect/Cause'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import type { ThreadReadError, ThreadSummary } from '../../../shared/ipc/ipc-contract/agent'
import type { Result } from '../../../shared/ipc/ipc-result'
import { ClaudeThreadReaderLive } from '../../adapters/agent/claude/runtime/claude-thread-reader'
import { listThreads } from '../../application/agent/usecase/list-threads'

export const handleListThreads = (
  cwd: string
): Promise<Result<readonly ThreadSummary[], ThreadReadError>> => {
  const program = listThreads(cwd).pipe(Effect.provide(ClaudeThreadReaderLive))

  return Effect.runPromiseExit(program).then(
    (exit): Result<readonly ThreadSummary[], ThreadReadError> =>
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
