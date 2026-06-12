// IPC endpoint for starting an agent run. Runs the runAgent use case with the shared RuntimeAgent through
// the shared runIpc wrapper, which logs the run-start ack. Each AG-UI event is forwarded to the renderer
// via the send callback; the forward loop is forked so the endpoint returns as soon as the run starts.
// The BaseEvent stream cannot cross IPC, so the endpoint returns a plain ack Result carrying the minted
// runId. The forked forwarding stream is not per-event logged here. Never throws across IPC.

import type { BaseEvent } from '@ag-ui/core'
import * as Effect from 'effect/Effect'
import * as Stream from 'effect/Stream'
import { AGENT_RUN_CHANNEL } from '../../../shared/ipc/ipc-contract/agent'
import type { RunAgentError, RunAgentInput } from '../../../shared/ipc/ipc-contract/agent'
import type { AgentToolCall } from '../../../shared/ipc/ipc-event-contract/agent'
import type { Result } from '../../../shared/ipc/ipc-result'
import { RuntimeAgent } from '../../application/agent/port/runtime-agent.port'
import { runAgent } from '../../application/agent/usecase/run-agent'
import { runIpc } from '../shared/run-ipc'
import type { Annotations } from '../shared/ipc-log'
import { runtimeAgent } from './runtime-agent'

export interface RunAgentArgs {
  readonly input: RunAgentInput
  readonly send: (event: BaseEvent) => void
  readonly sendToolCall: (call: AgentToolCall) => void
}

export const handleRunAgent = (
  args: RunAgentArgs
): Promise<Result<{ runId: string }, RunAgentError>> => {
  const start = Effect.gen(function* () {
    const run = yield* runAgent(args.input, args.sendToolCall)
    yield* Effect.forkDaemon(
      Stream.runForEach(run.events, (event) => Effect.sync(() => args.send(event)))
    )
    return { runId: run.runId }
  }).pipe(Effect.provideService(RuntimeAgent, runtimeAgent))

  const annotations: Annotations | undefined =
    args.input.threadId === undefined ? undefined : { threadId: args.input.threadId }

  return runIpc({
    channel: AGENT_RUN_CHANNEL,
    annotations,
    effect: start,
    onError: (error) => ({ _tag: error._tag }),
    onDefect: () => ({ _tag: 'RunAgentFailed' })
  })
}
