// Calculation: build the Claude Agent SDK run options from our AgentRunState (plus threadId) and the
// per-run frontend-tool MCP server. Partial messages are enabled so the adapter can stream content/tool
// deltas as AG-UI events. Built-in Claude tools stay disabled (`tools: []`); the only tools offered are
// the renderer's frontend tools, registered through `mcpServers`. When such a server is present we also
// register a no-op `PreToolUse` hook: the SDK requires one in streaming-input mode to hold the stream
// open while a tool handler suspends (waiting on the renderer). A threadId, when present, resumes that
// session. Model and effort come from the run state, falling back to the adapter defaults. Every run
// carries the custom writing-assistant system prompt instead of the SDK's minimal default.

import type { McpSdkServerConfigWithInstance } from '@anthropic-ai/claude-agent-sdk'
import type { Tool } from '@ag-ui/core'
import type { RunAgentState } from '../../../../application/agent/data/run-agent-state'
import type { ClaudeRunOptions } from '../data/claude-run-options'
import { AGENT_SYSTEM_PROMPT } from './agent-system-prompt'

const DEFAULT_MODEL = 'claude-opus-4-8'
const DEFAULT_EFFORT = 'medium'
const TOOL_SERVER_KEY = 'frontend'

// What a run needs to build its options: the session to resume (threadId), the run state (model/effort),
// the per-run frontend-tool MCP server (absent when the run offers no tools), and the tool specs that
// server exposes (their names become the permission allow-list).
interface BuildOptionsInput {
  readonly threadId: string | undefined
  readonly cwd: string | undefined
  readonly state: RunAgentState | undefined
  readonly toolServer: McpSdkServerConfigWithInstance | undefined
  readonly tools: readonly Tool[]
}

// The no-op hook that keeps the streaming-input query open while a suspended tool handler awaits the
// renderer. It always allows the call to proceed.
const holdStreamOpen: ClaudeRunOptions['hooks'] = {
  PreToolUse: [{ hooks: [async () => ({ continue: true })] }]
}

// The SDK gates MCP tools behind its permission system; without this allow-list the agent is denied and
// asks the user to grant access (which our headless run can't answer). Each frontend tool is allowed by
// its namespaced name `mcp__<serverKey>__<toolName>`. These are our own first-party editing tools the user
// invokes by chatting, so granting them is the intended behavior, not a bypass.
const frontendAllowedTools = (tools: readonly Tool[]): readonly string[] =>
  tools.map((spec) => `mcp__${TOOL_SERVER_KEY}__${spec.name}`)

const toolServerOptions = (
  toolServer: McpSdkServerConfigWithInstance | undefined,
  tools: readonly Tool[]
): Pick<ClaudeRunOptions, 'mcpServers' | 'hooks' | 'allowedTools'> =>
  toolServer === undefined
    ? {}
    : {
        mcpServers: { [TOOL_SERVER_KEY]: toolServer },
        hooks: holdStreamOpen,
        allowedTools: [...frontendAllowedTools(tools)]
      }

const buildOptions = (input: BuildOptionsInput): ClaudeRunOptions => ({
  includePartialMessages: true,
  tools: [],
  systemPrompt: AGENT_SYSTEM_PROMPT,
  model: input.state?.model ?? DEFAULT_MODEL,
  effort: input.state?.effort ?? DEFAULT_EFFORT,
  ...toolServerOptions(input.toolServer, input.tools),
  ...(input.threadId === undefined ? {} : { resume: input.threadId }),
  ...(input.cwd === undefined ? {} : { cwd: input.cwd })
})

export {
  buildOptions,
  frontendAllowedTools,
  DEFAULT_MODEL,
  TOOL_SERVER_KEY,
  type BuildOptionsInput
}
