// Calculation: build the Claude Agent SDK run options from our AgentRunState (plus threadId) and the
// per-run frontend-tool MCP server. Partial messages are enabled so the adapter can stream content/tool
// deltas as AG-UI events. Built-in Claude tools stay disabled (`tools: []`); the only tools offered are
// the renderer's frontend tools, registered through `mcpServers`. When such a server is present we also
// register a no-op `PreToolUse` hook: the SDK requires one in streaming-input mode to hold the stream
// open while a tool handler suspends (waiting on the renderer). A threadId, when present, resumes that
// session. Model and effort come from the run state, falling back to the adapter defaults.

import type { McpSdkServerConfigWithInstance } from '@anthropic-ai/claude-agent-sdk'
import type { RunAgentState } from '../../../../application/agent/data/run-agent-state'
import type { ClaudeRunOptions } from '../data/claude-run-options'

const DEFAULT_MODEL = 'claude-opus-4-8'
const DEFAULT_EFFORT = 'medium'
const TOOL_SERVER_KEY = 'frontend'

// What a run needs to build its options: the session to resume (threadId), the run state (model/effort),
// and the per-run frontend-tool MCP server (absent when the run offers no tools).
interface BuildOptionsInput {
  readonly threadId: string | undefined
  readonly cwd: string | undefined
  readonly state: RunAgentState | undefined
  readonly toolServer: McpSdkServerConfigWithInstance | undefined
}

// The no-op hook that keeps the streaming-input query open while a suspended tool handler awaits the
// renderer. It always allows the call to proceed.
const holdStreamOpen: ClaudeRunOptions['hooks'] = {
  PreToolUse: [{ hooks: [async () => ({ continue: true })] }]
}

const toolServerOptions = (
  toolServer: McpSdkServerConfigWithInstance | undefined
): Pick<ClaudeRunOptions, 'mcpServers' | 'hooks'> =>
  toolServer === undefined
    ? {}
    : { mcpServers: { [TOOL_SERVER_KEY]: toolServer }, hooks: holdStreamOpen }

const buildOptions = (input: BuildOptionsInput): ClaudeRunOptions => ({
  includePartialMessages: true,
  tools: [],
  model: input.state?.model ?? DEFAULT_MODEL,
  effort: input.state?.effort ?? DEFAULT_EFFORT,
  ...toolServerOptions(input.toolServer),
  ...(input.threadId === undefined ? {} : { resume: input.threadId }),
  ...(input.cwd === undefined ? {} : { cwd: input.cwd })
})

export { buildOptions, TOOL_SERVER_KEY, type BuildOptionsInput }
