// Compares the current run against the accumulated history to turn raw numbers into judgment. For each
// metric it derives a baseline (the median of that metric's per-run medians across prior runs *on the
// same machine* — cross-machine numbers are not comparable) and the percentage change from it; a rise of
// more than 20% is flagged as a regression. Some metrics also carry an absolute perception budget
// (e.g. a keystroke should paint within ~50ms); those report whether the current run stays within it.
// Pure: runs in, comparisons out — no thresholds are asserted here, the report just surfaces them.

import { summarize } from './stats'
import type { RunRecord } from './assemble-run'
import type { PerfMetric, PerfUnit, ScenarioResult } from './scenario-result'

const REGRESSION_THRESHOLD_PCT = 20

const PERCEPTION_BUDGETS: Record<string, number> = {
  'keystroke-to-paint': 50
}

type MetricComparison = {
  readonly scenario: string
  readonly metric: string
  readonly unit: PerfUnit
  readonly current: number
  readonly baseline: number | null
  readonly deltaPct: number | null
  readonly regressed: boolean
  readonly budget: number | null
  readonly withinBudget: boolean | null
}

type CompareInput = {
  readonly scenario: string
  readonly metric: PerfMetric
  readonly history: readonly RunRecord[]
}

const medianOf = (samples: readonly number[]): number => summarize(samples).median

const metricMedians = (scenario: ScenarioResult, metric: string): readonly number[] =>
  scenario.metrics.filter((m) => m.name === metric).map((m) => medianOf(m.samples))

const priorMediansFor = (input: CompareInput): readonly number[] =>
  input.history.flatMap((run) =>
    run.scenarios
      .filter((s) => s.scenario === input.scenario)
      .flatMap((s) => metricMedians(s, input.metric.name))
  )

const buildComparison = (input: CompareInput): MetricComparison => {
  const current = medianOf(input.metric.samples)
  const priors = priorMediansFor(input)
  const baseline = priors.length === 0 ? null : medianOf(priors)
  const deltaPct =
    baseline !== null && baseline > 0 ? ((current - baseline) / baseline) * 100 : null
  const budget = PERCEPTION_BUDGETS[input.metric.name] ?? null
  return {
    scenario: input.scenario,
    metric: input.metric.name,
    unit: input.metric.unit,
    current,
    baseline,
    deltaPct,
    regressed: deltaPct !== null && deltaPct > REGRESSION_THRESHOLD_PCT,
    budget,
    withinBudget: budget === null ? null : current <= budget
  }
}

const compareRun = (
  current: RunRecord,
  history: readonly RunRecord[]
): readonly MetricComparison[] => {
  const sameMachine = history.filter((run) => run.context.machine === current.context.machine)
  return current.scenarios.flatMap((scenario) =>
    scenario.metrics.map((metric) =>
      buildComparison({ scenario: scenario.scenario, metric, history: sameMachine })
    )
  )
}

export { compareRun, REGRESSION_THRESHOLD_PCT, type MetricComparison }
