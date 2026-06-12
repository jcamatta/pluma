// Business type: what the renderer sends to start an agent run. `messages` is the AG-UI conversation
// history (the user's turn plus any prior turns); an optional `threadId` resumes an existing session.
// `cwd` is the open workspace folder, which the SDK keys the session under so threads scope per
// workspace. `tools` are the frontend tools offered to the agent for this run. `state` is the AG-UI
// run state (effort, model). `context` is the AG-UI context channel — the per-session facts folded
// into a fresh run's opening message. The runId is minted by the runtime, not the caller. This is the
// plain payload that crosses IPC; the agent's reply streams back as AG-UI events.

import type { Message, Tool } from '@ag-ui/core'
import type { AgentContextEntry } from './agent-context-entry'
import type { RunAgentState } from './run-agent-state'

export interface RunAgentInput {
  readonly messages: readonly Message[]
  readonly threadId?: string
  readonly cwd?: string
  readonly tools: readonly Tool[]
  readonly state?: RunAgentState
  readonly context?: readonly AgentContextEntry[]
}
