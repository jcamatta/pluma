// IPC endpoint for starting an agent run. Runs the runAgent use case with the shared RuntimeAgent, then
// forwards each AG-UI event to the renderer via the send callback. The forward loop is forked so the
// endpoint returns as soon as the run starts; the BaseEvent stream cannot cross IPC, so the endpoint
// returns a plain ack Result carrying the minted runId. Never throws across IPC.

import type { BaseEvent } from '@ag-ui/core'
import * as Cause from 'effect/Cause'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as Stream from 'effect/Stream'
import type { RunAgentInput } from '../../application/agent/data/run-agent-input'
import type { RunAgentFailed } from '../../application/agent/error/run-agent-failed'
import { RuntimeAgent } from '../../application/agent/port/runtime-agent.port'
import { runAgent } from '../../application/agent/usecase/run-agent'
import type { Result } from '../result'
import { runtimeAgent } from './runtime-agent'

type SerializedError = { readonly _tag: RunAgentFailed['_tag'] }

export interface RunAgentArgs {
  readonly input: RunAgentInput
  readonly send: (event: BaseEvent) => void
}

export const handleRunAgent = (
  args: RunAgentArgs
): Promise<Result<{ runId: string }, SerializedError>> => {
  const program = Effect.gen(function* () {
    const run = yield* runAgent(args.input)
    yield* Effect.forkDaemon(
      Stream.runForEach(run.events, (event) => Effect.sync(() => args.send(event)))
    )
    return run.runId
  }).pipe(Effect.provideService(RuntimeAgent, runtimeAgent))

  return Effect.runPromiseExit(program).then(
    (exit): Result<{ runId: string }, SerializedError> =>
      Exit.match(exit, {
        onSuccess: (runId) => ({ ok: true, value: { runId } }),
        onFailure: (cause) => {
          const error = Cause.failureOption(cause)
          return error._tag === 'Some'
            ? { ok: false, error: { _tag: error.value._tag } }
            : { ok: false, error: { _tag: 'RunAgentFailed' } }
        }
      })
  )
}
