// Business types for frontend tools: the result a handler returns. `AgentToolOutput` is what the
// agent ultimately sees (text or structured JSON); `AgentToolResult` wraps it in a success/error
// discriminated union so a handler can report a recoverable failure (range drifted, not found,
// ambiguous) without throwing. Ported from the reference `shared/agent/tools.ts`, renderer-local.

type AgentToolOutput =
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: 'json'; readonly value: unknown }

type AgentToolResult =
  | { readonly ok: true; readonly output: AgentToolOutput }
  | { readonly ok: false; readonly error: string }

export type { AgentToolOutput, AgentToolResult }
