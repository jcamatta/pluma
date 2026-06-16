// The one-word verdict shown per metric in the report, in priority order: a regression past the
// threshold is the loudest signal; then breaching an absolute perception budget; then a first run with no
// baseline yet to compare against; otherwise all good. Plain words, no icons.

import type { MetricComparison } from './compare-baseline'

const verdictLabel = (comparison: MetricComparison): string => {
  if (comparison.regressed) return 'REGRESSED'
  if (comparison.withinBudget === false) return 'OVER BUDGET'
  if (comparison.baseline === null) return 'baseline'
  return 'ok'
}

export { verdictLabel }
