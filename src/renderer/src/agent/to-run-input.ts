// Calculation: map AG-UI's RunAgentInput (what AbstractAgent hands run()) to the IPC RunAgentInput
// (the payload that crosses to main). messages and tools pass through; threadId carries the AG-UI
// threadId so the backend can resume a session; context carries the AG-UI context channel (the
// per-session facts the backend folds into a fresh run's opening message); state is omitted here
// (model/effort are not yet driven from the renderer). Pure, so it is unit-testable without IPC.

import type { RunAgentInput } from '@ag-ui/client'
import type { RunAgentInput as IpcRunAgentInput } from '../../../shared/ipc/ipc-contract/agent'

export function toRunInput(input: RunAgentInput): IpcRunAgentInput {
  return {
    messages: input.messages,
    tools: input.tools,
    context: input.context,
    ...(input.threadId ? { threadId: input.threadId } : {})
  }
}
