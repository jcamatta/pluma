// Hook: holds the composer's model/effort selection (defaults from run-controls) and exposes them as
// ready-to-render Select controls plus the RunAgentState to stamp on the next run. Each Select hands back
// a raw string, narrowed to the typed union through the wire guards before it is stored. In-memory only —
// the choice resets with a fresh controller, which is the intended behavior for now.

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { EffortLevel, Model, RunAgentState } from '../../../shared/ipc/ipc-contract/agent'
import { isEffortLevel, isModel } from '../agent/run-state-guard'
import type { RunControlSelectProps } from './RunControlSelect.view'
import { DEFAULT_EFFORT, DEFAULT_MODEL, EFFORT_OPTIONS, MODEL_OPTIONS } from './run-controls'

interface RunControls {
  readonly model: RunControlSelectProps
  readonly effort: RunControlSelectProps
  readonly runState: RunAgentState
}

function useRunControls(): RunControls {
  const { t } = useTranslation()
  const [model, setModel] = useState<Model>(DEFAULT_MODEL)
  const [effort, setEffort] = useState<EffortLevel>(DEFAULT_EFFORT)

  return {
    model: {
      ariaLabel: t('rail.model.label'),
      value: model,
      options: MODEL_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) })),
      onValueChange: (value) => {
        if (isModel(value)) setModel(value)
      }
    },
    effort: {
      ariaLabel: t('rail.effort.label'),
      value: effort,
      options: EFFORT_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) })),
      onValueChange: (value) => {
        if (isEffortLevel(value)) setEffort(value)
      }
    },
    runState: { model, effort }
  }
}

export { useRunControls }
export type { RunControls }
