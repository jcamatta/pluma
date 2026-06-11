// Calculation: map AG-UI's RunAgentInput (what AbstractAgent hands run()) to the IPC RunAgentInput
// (the payload that crosses to main). messages and tools pass through; threadId carries the AG-UI
// threadId so the backend can resume a session; state is omitted here (model/effort are not yet
// driven from the renderer). The workspace cwd rides AG-UI's forwardedProps (its sanctioned
// pass-through channel) and is lifted here to a top-level cwd on our own IPC type, so the backend
// keys the SDK session under the open workspace folder. Pure, so it is unit-testable without IPC.

import type { RunAgentInput } from '@ag-ui/client'
import type { RunAgentInput as IpcRunAgentInput } from '../../../shared/ipc/ipc-contract/agent'

function forwardedCwd(forwardedProps: unknown): string | undefined {
  if (typeof forwardedProps !== 'object' || forwardedProps === null) return undefined
  if (!('cwd' in forwardedProps)) return undefined
  const candidate = forwardedProps.cwd
  return typeof candidate === 'string' && candidate.length > 0 ? candidate : undefined
}

export function toRunInput(input: RunAgentInput): IpcRunAgentInput {
  const cwd = forwardedCwd(input.forwardedProps)
  return {
    messages: input.messages,
    tools: input.tools,
    ...(input.threadId ? { threadId: input.threadId } : {}),
    ...(cwd === undefined ? {} : { cwd })
  }
}
