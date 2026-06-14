// Calculation: the agent's tools serialize their AgentToolResult to JSON, which the SDK echoes back as a
// tool_result block; the rail's TOOL_CALL_RESULT event carries that string as `content`. An { ok: false }
// result means the tool failed and its step must render as failed, not as a green-check success. Anything
// unparseable, or any result without an explicit ok:false, is treated as success — the reducer must never
// throw on a malformed result, and a missing flag is not evidence of failure.

import type { LogStatus } from './activity-log'

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
