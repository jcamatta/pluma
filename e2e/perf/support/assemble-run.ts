// Combines the run context with the scenarios collected from the pending area into one record — the unit
// that is written to disk and later compared against history. Scenarios are sorted by name so the run
// file and the report are deterministic regardless of which scenario finished first.

import type { RunContext } from './run-context'
import type { ScenarioResult } from './scenario-result'

type RunRecord = {
  readonly context: RunContext
  readonly scenarios: readonly ScenarioResult[]
}

const assembleRun = (context: RunContext, scenarios: readonly ScenarioResult[]): RunRecord => ({
  context,
  scenarios: [...scenarios].sort((a, b) => a.scenario.localeCompare(b.scenario))
})

export { assembleRun, type RunRecord }
