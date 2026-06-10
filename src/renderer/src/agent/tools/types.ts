// Business types for frontend tools: the result a handler returns. `AgentToolOutput` is what the
// agent ultimately sees (text or structured JSON); `AgentToolResult` wraps it in a success/error
// discriminated union so a handler can report a recoverable failure (range drifted, not found,
// ambiguous) without throwing. These are defined once in the shared IPC contract (they cross the wire
// as the agent:tool-result payload) and re-exported here so the renderer keeps a single source.

export type { AgentToolOutput, AgentToolResult } from '../../../../shared/ipc/ipc-contract/agent'
