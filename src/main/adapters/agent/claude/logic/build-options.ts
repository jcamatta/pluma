// Calculation: build the Claude Agent SDK run options from our AgentRunState (plus threadId). Partial
// messages are enabled so the adapter can stream content/tool deltas as AG-UI events. Built-in Claude
// tools are disabled by default (`tools: []`); only frontend tools are offered. A threadId, when present,
// resumes that session. Model and effort come from the run state, falling back to the adapter defaults.

import type { RunAgentState } from '../../../../application/agent/data/run-agent-state'
import type { ClaudeRunOptions } from '../data/claude-run-options'

const DEFAULT_MODEL = 'claude-opus-4-8'
const DEFAULT_EFFORT = 'medium'

export const buildOptions = (
  threadId: string | undefined,
  state: RunAgentState | undefined
): ClaudeRunOptions => ({
  includePartialMessages: true,
  tools: [],
  model: state?.model ?? DEFAULT_MODEL,
  effort: state?.effort ?? DEFAULT_EFFORT,
  ...(threadId === undefined ? {} : { resume: threadId })
})
