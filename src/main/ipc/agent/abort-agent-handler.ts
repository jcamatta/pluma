// IPC endpoint for aborting an in-flight agent run. Runs the abortAgent use case with the shared
// RuntimeAgent. Aborting an unknown or finished run is a no-op, so this always returns an ok ack. Never
// throws across IPC.

import * as Effect from 'effect/Effect'
import type { Result } from '../../../shared/ipc/ipc-result'
import { RuntimeAgent } from '../../application/agent/port/runtime-agent.port'
import { abortAgent } from '../../application/agent/usecase/abort-agent'
import { runtimeAgent } from './runtime-agent'

export const handleAbortAgent = (runId: string): Promise<Result<null, never>> => {
  const program = abortAgent(runId).pipe(Effect.provideService(RuntimeAgent, runtimeAgent))

  return Effect.runPromise(program).then((): Result<null, never> => ({ ok: true, value: null }))
}
