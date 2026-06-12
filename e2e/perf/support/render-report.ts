// Turns a consolidated run into the human-readable report: a provenance header followed by one section
// per scenario, each a table of its metrics summarized to median / p95 / min / max over the raw samples,
// alongside the baseline, percentage change, and verdict from the comparison against history. Pure — run
// and comparisons in, markdown string out — so it is unit-tested without touching the filesystem.

import { formatValue } from './format-value'
import { summarize } from './stats'
import { verdictLabel } from './verdict-label'
import type { RunRecord } from './assemble-run'
import type { MetricComparison } from './compare-baseline'
import type { PerfMetric, ScenarioResult } from './scenario-result'

type Lookup = ReadonlyMap<string, MetricComparison>

const header = [
  '| Metric | Median | p95 | Min | Max | Samples | Baseline | Δ% | Verdict |',
  '| --- | --- | --- | --- | --- | --- | --- | --- | --- |'
]

const comparisonKey = (scenario: string, metric: string): string => `${scenario}::${metric}`

const formatDelta = (deltaPct: number | null): string =>
  deltaPct === null ? '—' : `${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(1)}%`

const metricRow = (metric: PerfMetric, comparison: MetricComparison | undefined): string => {
  const stats = summarize(metric.samples)
  const show = (value: number): string => formatValue(value, metric.unit)
  const baseline =
    comparison === undefined || comparison.baseline === null ? '—' : show(comparison.baseline)
  const delta = formatDelta(comparison === undefined ? null : comparison.deltaPct)
  const verdict = comparison === undefined ? '—' : verdictLabel(comparison)
  return `| ${metric.name} | ${show(stats.median)} | ${show(stats.p95)} | ${show(stats.min)} | ${show(stats.max)} | ${stats.count} | ${baseline} | ${delta} | ${verdict} |`
}

const section = (scenario: ScenarioResult, lookup: Lookup): string =>
  [
    `## ${scenario.scenario}`,
    '',
    ...header,
    ...scenario.metrics.map((metric) =>
      metricRow(metric, lookup.get(comparisonKey(scenario.scenario, metric.name)))
    )
  ].join('\n')

const provenance = (run: RunRecord): readonly string[] => [
  '# Performance report',
  '',
  `- Commit: \`${run.context.commit}\``,
  `- Version: ${run.context.version}`,
  `- Machine: ${run.context.machine}`,
  `- Generated: ${run.context.timestamp}`
]

const renderReport = (run: RunRecord, comparisons: readonly MetricComparison[]): string => {
  const lookup: Lookup = new Map(comparisons.map((c) => [comparisonKey(c.scenario, c.metric), c]))
  return `${[...provenance(run), '', ...run.scenarios.map((s) => section(s, lookup))].join('\n')}\n`
}

export { renderReport }
