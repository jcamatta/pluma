// Business types for the frontend-tool round-trip, used by the application and adapter layers (which must
// not import the wire contract). An AgentToolCall is a tool the agent invoked, to be run in the renderer;
// the renderer answers with an AgentToolResultMessage carrying the AgentToolResult. These are structurally
// identical to the wire types in shared/ipc; the agent ipc handlers map between the two ends, the same way
// RunAgentInput is mirrored across the boundary.

type AgentToolOutput =
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: 'json'; readonly value: unknown }

type AgentToolResult =
  | { readonly ok: true; readonly output: AgentToolOutput }
  | { readonly ok: false; readonly error: string }

interface AgentToolCall {
  readonly runId: string
  readonly toolCallId: string
  readonly toolName: string
  readonly args: unknown
}

interface AgentToolResultMessage {
  readonly runId: string
  readonly toolCallId: string
  readonly result: AgentToolResult
}

export type { AgentToolOutput, AgentToolResult, AgentToolCall, AgentToolResultMessage }
