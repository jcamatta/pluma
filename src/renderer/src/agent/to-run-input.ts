// Calculation: map AG-UI's RunAgentInput (what AbstractAgent hands run()) to the IPC RunAgentInput
// (the payload that crosses to main). messages and tools pass through; threadId carries the AG-UI
// threadId so the backend can resume a session; state is omitted here (model/effort are not yet
// driven from the renderer). Pure, so it is unit-testable without IPC.

import type { RunAgentInput } from '@ag-ui/client'
import type { RunAgentInput as IpcRunAgentInput } from '../../../shared/ipc/ipc-contract/agent'

export function toRunInput(input: RunAgentInput): IpcRunAgentInput {
  return {
    messages: input.messages,
    tools: input.tools,
    ...(input.threadId ? { threadId: input.threadId } : {})
  }
}
