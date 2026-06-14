// Calculation: the agent's tools serialize their AgentToolResult to JSON, which the SDK echoes back as a
// tool_result block; that string lands as the tool message's `content` and the projection keeps it as the
// step's meta. An { ok: false } result means the tool failed and its step must render as failed, not as a
// green-check success. Anything unparseable, or any result without an explicit ok:false, is treated as
// success — the projection must never throw on a malformed result, and a missing flag is not evidence of
// failure.

import type { LogStatus } from './step'

const isFailedResult = (value: unknown): boolean =>
  typeof value === 'object' && value !== null && 'ok' in value && value.ok === false

const toolOutcomeStatus = (content: string): LogStatus => {
  try {
    return isFailedResult(JSON.parse(content)) ? 'failed' : 'success'
  } catch {
    return 'success'
  }
}

export { toolOutcomeStatus }
