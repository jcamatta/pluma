// Data: the curated model/effort choices the composer offers, plus the defaults a fresh chat starts on.
// Each option pairs a wire value (typed against the IPC Model/EffortLevel, so a typo will not compile)
// with an i18n label key the controller resolves through t() at the view boundary. The effort list is
// deliberately the three standard levels — the wire union also allows xhigh/max, which the UI does not
// offer. Plain data with no behavior; the field guards that narrow a Select's value live in
// agent/run-state-guard.

import type { EffortLevel, Model } from '../../../shared/ipc/ipc-contract/agent'

interface ModelOption {
  readonly value: Model
  readonly labelKey: string
}

interface EffortOption {
  readonly value: EffortLevel
  readonly labelKey: string
}

const MODEL_OPTIONS: readonly ModelOption[] = [
  { value: 'claude-opus-4-8', labelKey: 'rail.model.opus' },
  { value: 'claude-sonnet-4-6', labelKey: 'rail.model.sonnet' }
]

const EFFORT_OPTIONS: readonly EffortOption[] = [
  { value: 'low', labelKey: 'rail.effort.low' },
  { value: 'medium', labelKey: 'rail.effort.medium' },
  { value: 'high', labelKey: 'rail.effort.high' }
]

const DEFAULT_MODEL: Model = 'claude-opus-4-8'
const DEFAULT_EFFORT: EffortLevel = 'medium'

export { DEFAULT_EFFORT, DEFAULT_MODEL, EFFORT_OPTIONS, MODEL_OPTIONS }
export type { EffortOption, ModelOption }
