// Calculation: validate the wire RunAgentState and its fields. The renderer stamps a typed RunAgentState
// onto AG-UI forwardedProps; on the way to IPC (toRunInput) we guard it back from `unknown` so a stray
// value never reaches the SDK, and the composer reuses the field guards to narrow a Select's value back
// to the typed unions — both without a cast. Pure, so it is unit-testable without a DOM or IPC.

import type { EffortLevel, Model, RunAgentState } from '../../../shared/ipc/ipc-contract/agent'

const MODELS: ReadonlySet<string> = new Set(['claude-opus-4-8', 'claude-sonnet-4-6'])
const EFFORT_LEVELS: ReadonlySet<string> = new Set(['low', 'medium', 'high', 'xhigh', 'max'])

function isModel(value: unknown): value is Model {
  return typeof value === 'string' && MODELS.has(value)
}

function isEffortLevel(value: unknown): value is EffortLevel {
  return typeof value === 'string' && EFFORT_LEVELS.has(value)
}

function field(source: object, key: string): unknown {
  return key in source ? Reflect.get(source, key) : undefined
}

function toRunState(value: unknown): RunAgentState | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const model = field(value, 'model')
  const effort = field(value, 'effort')
  const state: RunAgentState = {
    ...(isModel(model) ? { model } : {}),
    ...(isEffortLevel(effort) ? { effort } : {})
  }
  return state.model === undefined && state.effort === undefined ? undefined : state
}

export { isEffortLevel, isModel, toRunState }
