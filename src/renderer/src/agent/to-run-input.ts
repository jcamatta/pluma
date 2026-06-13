// Calculation: map AG-UI's RunAgentInput (what AbstractAgent hands run()) to the IPC RunAgentInput
// (the payload that crosses to main). messages and tools pass through; threadId carries the AG-UI
// threadId so the backend can resume a session; context carries the AG-UI context channel (the
// per-session facts the backend folds into a fresh run's opening message). Both the workspace cwd and
// the run state (model/effort) ride AG-UI's forwardedProps (its sanctioned pass-through channel) and
// are lifted here to top-level fields on our own IPC type — cwd so the backend keys the SDK session
// under the open workspace folder, state so the chosen model/effort reach the SDK. Pure, so it is
// unit-testable without IPC.

import type { RunAgentInput } from '@ag-ui/client'
import type {
  RunAgentInput as IpcRunAgentInput,
  RunAgentState
} from '../../../shared/ipc/ipc-contract/agent'
import { toRunState } from './run-state-guard'

function forwardedCwd(forwardedProps: unknown): string | undefined {
  if (typeof forwardedProps !== 'object' || forwardedProps === null) return undefined
  if (!('cwd' in forwardedProps)) return undefined
  const candidate = forwardedProps.cwd
  return typeof candidate === 'string' && candidate.length > 0 ? candidate : undefined
}

function forwardedRunState(forwardedProps: unknown): RunAgentState | undefined {
  if (typeof forwardedProps !== 'object' || forwardedProps === null) return undefined
  if (!('state' in forwardedProps)) return undefined
  return toRunState(forwardedProps.state)
}

export function toRunInput(input: RunAgentInput): IpcRunAgentInput {
  const cwd = forwardedCwd(input.forwardedProps)
  const state = forwardedRunState(input.forwardedProps)
  return {
    messages: input.messages,
    tools: input.tools,
    context: input.context,
    ...(input.threadId ? { threadId: input.threadId } : {}),
    ...(cwd === undefined ? {} : { cwd }),
    ...(state === undefined ? {} : { state })
  }
}
