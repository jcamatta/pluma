// IPC endpoint for aborting an in-flight agent run. Runs the abortAgent use case with the shared
// RuntimeAgent through runIpcAck, which logs the call. Aborting an unknown or finished run is a no-op, so
// this always returns an ok ack. Never throws across IPC.

import * as Effect from 'effect/Effect'
import { AGENT_ABORT_CHANNEL } from '../../../shared/ipc/ipc-contract/agent'
import type { Result } from '../../../shared/ipc/ipc-result'
import { RuntimeAgent } from '../../application/agent/port/runtime-agent.port'
import { abortAgent } from '../../application/agent/usecase/abort-agent'
import { runIpcAck } from '../shared/run-ipc-ack'
import { runtimeAgent } from './runtime-agent'

export const handleAbortAgent = (runId: string): Promise<Result<null, never>> =>
  runIpcAck({
    channel: AGENT_ABORT_CHANNEL,
    annotations: { runId },
    effect: abortAgent(runId).pipe(Effect.provideService(RuntimeAgent, runtimeAgent))
  })
