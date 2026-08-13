// The closed vocabulary of run failures the UI treats differently. It rides AG-UI's own optional
// `code` field on RUN_ERROR (`RunErrorEventSchema` is `{ type, message: string, code?: string }`) over
// the existing agent:event channel — no new event type, no parallel error envelope; this union only
// narrows what that protocol-defined string may be at our boundary.
//
// Reads arrive as `unknown` because BaseEvent is a zod passthrough type, so all the structural
// narrowing lives in toAgentRunFailure rather than at each call site. Anything the app does not handle
// specially — an unrecognised string, a non-string, an absent code — collapses to 'generic'.

const AGENT_RUN_FAILURES = ['authentication', 'generic'] as const

type AgentRunFailure = (typeof AGENT_RUN_FAILURES)[number]

const toAgentRunFailure = (code: unknown): AgentRunFailure =>
  AGENT_RUN_FAILURES.find((failure) => failure === code) ?? 'generic'

export { AGENT_RUN_FAILURES, toAgentRunFailure }
export type { AgentRunFailure }
