// Turns a consolidated run into the human-readable report: a provenance header followed by one section
// per scenario, each a table of its metrics summarized to median / p95 / min / max over the raw samples.
// Pure — run record in, markdown string out — so it is unit-tested without touching the filesystem.

import { formatValue } from './format-value'
import { summarize } from './stats'
import type { RunRecord } from './assemble-run'
import type { PerfMetric, ScenarioResult } from './scenario-result'

const header = [
  '| Metric | Median | p95 | Min | Max | Samples |',
  '| --- | --- | --- | --- | --- | --- |'
]

const metricRow = (metric: PerfMetric): string => {
  const stats = summarize(metric.samples)
  const show = (value: number): string => formatValue(value, metric.unit)
  return `| ${metric.name} | ${show(stats.median)} | ${show(stats.p95)} | ${show(stats.min)} | ${show(stats.max)} | ${stats.count} |`
}

const section = (scenario: ScenarioResult): string =>
  [`## ${scenario.scenario}`, '', ...header, ...scenario.metrics.map(metricRow)].join('\n')

const provenance = (run: RunRecord): readonly string[] => [
  '# Performance report',
  '',
  `- Commit: \`${run.context.commit}\``,
  `- Version: ${run.context.version}`,
  `- Machine: ${run.context.machine}`,
  `- Generated: ${run.context.timestamp}`
]

const renderReport = (run: RunRecord): string =>
  `${[...provenance(run), '', ...run.scenarios.map(section)].join('\n')}\n`

export { renderReport }
