// Calculation: build the Claude Agent SDK run options from our AgentRunState (plus threadId) and the
// per-run tool MCP servers. Partial messages are enabled so the adapter can stream content/tool deltas as
// AG-UI events. Built-in Claude tools stay disabled (`tools: []`); the only tools offered are the
// renderer's frontend tools and the in-process backend read tools, each registered under `mcpServers` by
// its own key, with their namespaced names merged into the permission allow-list. When any server is
// present we also register a no-op `PreToolUse` hook: the SDK requires one in streaming-input mode to
// hold the stream open while a tool handler suspends (waiting on the renderer); it is harmless for the
// non-suspending backend tools. A threadId, when present, resumes that session. Model and effort come
// from the run state, falling back to the adapter defaults. Every run carries the custom
// writing-assistant system prompt instead of the SDK's minimal default.

import type { McpSdkServerConfigWithInstance } from '@anthropic-ai/claude-agent-sdk'
import type { Tool } from '@ag-ui/core'
import type { RunAgentState } from '../../../../application/agent/data/run-agent-state'
import type { ClaudeRunOptions } from '../data/claude-run-options'
import { AGENT_SYSTEM_PROMPT } from './agent-system-prompt'

const DEFAULT_MODEL = 'claude-opus-4-8'
const DEFAULT_EFFORT = 'medium'
const TOOL_SERVER_KEY = 'frontend'
const BACKEND_TOOL_SERVER_KEY = 'backend'

// What a run needs to build its options: the session to resume (threadId), the run state (model/effort),
// the per-run frontend-tool MCP server (absent when the run offers no tools) and its tool specs (their
// names become the permission allow-list), and the in-process backend-tool server with its specs.
interface BuildOptionsInput {
  readonly threadId: string | undefined
  readonly cwd: string | undefined
  readonly state: RunAgentState | undefined
  readonly toolServer: McpSdkServerConfigWithInstance | undefined
  readonly tools: readonly Tool[]
  readonly backendToolServer?: McpSdkServerConfigWithInstance
  readonly backendTools?: readonly Tool[]
}

// The no-op hook that keeps the streaming-input query open while a suspended tool handler awaits the
// renderer. It always allows the call to proceed.
const holdStreamOpen: ClaudeRunOptions['hooks'] = {
  PreToolUse: [{ hooks: [async () => ({ continue: true })] }]
}

// The SDK gates MCP tools behind its permission system; without this allow-list the agent is denied and
// asks the user to grant access (which our headless run can't answer). Each tool is allowed by its
// namespaced name `mcp__<serverKey>__<toolName>`. These are our own first-party tools the user invokes by
// chatting, so granting them is the intended behavior, not a bypass.
const allowedToolsFor = (serverKey: string, tools: readonly Tool[]): readonly string[] =>
  tools.map((spec) => `mcp__${serverKey}__${spec.name}`)

const frontendAllowedTools = (tools: readonly Tool[]): readonly string[] =>
  allowedToolsFor(TOOL_SERVER_KEY, tools)

type ServerOptions = Pick<ClaudeRunOptions, 'mcpServers' | 'hooks' | 'allowedTools'>

const toolServerOptions = (input: BuildOptionsInput): ServerOptions => {
  const mcpServers = {
    ...(input.toolServer === undefined ? {} : { [TOOL_SERVER_KEY]: input.toolServer }),
    ...(input.backendToolServer === undefined
      ? {}
      : { [BACKEND_TOOL_SERVER_KEY]: input.backendToolServer })
  }
  if (Object.keys(mcpServers).length === 0) return {}
  return {
    mcpServers,
    hooks: holdStreamOpen,
    allowedTools: [
      ...allowedToolsFor(TOOL_SERVER_KEY, input.toolServer === undefined ? [] : input.tools),
      ...allowedToolsFor(
        BACKEND_TOOL_SERVER_KEY,
        input.backendToolServer === undefined ? [] : (input.backendTools ?? [])
      )
    ]
  }
}

const buildOptions = (input: BuildOptionsInput): ClaudeRunOptions => ({
  includePartialMessages: true,
  tools: [],
  systemPrompt: AGENT_SYSTEM_PROMPT,
  model: input.state?.model ?? DEFAULT_MODEL,
  effort: input.state?.effort ?? DEFAULT_EFFORT,
  ...toolServerOptions(input),
  ...(input.threadId === undefined ? {} : { resume: input.threadId }),
  ...(input.cwd === undefined ? {} : { cwd: input.cwd })
})

export {
  buildOptions,
  frontendAllowedTools,
  DEFAULT_MODEL,
  TOOL_SERVER_KEY,
  BACKEND_TOOL_SERVER_KEY,
  type BuildOptionsInput
}
