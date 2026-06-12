// The data a single perf scenario emits. A scenario produces one or more named metrics, each carrying
// the raw per-iteration samples (never a single number) so the full granularity survives into the run
// JSON; summaries (median/p95) are derived from these samples at render time, not stored in their place.

type PerfUnit = 'ms' | 'bytes' | 'count'

type PerfMetric = {
  readonly name: string
  readonly unit: PerfUnit
  readonly samples: readonly number[]
}

type ScenarioResult = {
  readonly scenario: string
  readonly iterations: number
  readonly metrics: readonly PerfMetric[]
}

export type { PerfUnit, PerfMetric, ScenarioResult }
