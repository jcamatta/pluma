// IPC endpoint for returning a frontend tool's result to the in-flight run. The renderer ran the tool the
// agent called and invokes agent:tool-result with the output; this resolves the suspended SDK tool handler
// so the run continues. Runs through runIpcAck, which logs the call. Resolves a plain ack Result; never
// throws across IPC.

import * as Effect from 'effect/Effect'
import { AGENT_TOOL_RESULT_CHANNEL } from '../../../shared/ipc/ipc-contract/agent'
import type { AgentToolResultMessage } from '../../../shared/ipc/ipc-contract/agent'
import type { Result } from '../../../shared/ipc/ipc-result'
import { RuntimeAgent } from '../../application/agent/port/runtime-agent.port'
import { submitToolResult } from '../../application/agent/usecase/submit-tool-result'
import { runIpcAck } from '../shared/run-ipc-ack'
import { runtimeAgent } from './runtime-agent'

export const handleSubmitToolResult = (
  message: AgentToolResultMessage
): Promise<Result<null, never>> =>
  runIpcAck({
    channel: AGENT_TOOL_RESULT_CHANNEL,
    annotations: { runId: message.runId, toolCallId: message.toolCallId },
    effect: submitToolResult(message).pipe(Effect.provideService(RuntimeAgent, runtimeAgent))
  })
