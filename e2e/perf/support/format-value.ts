// Renders a measured number for the report in the units a reader expects: milliseconds as-is, memory in
// megabytes (raw byte counts are unreadable), and plain counts. Two decimals everywhere so columns line
// up and small deltas stay visible.

import type { PerfUnit } from './scenario-result'

const formatValue = (value: number, unit: PerfUnit): string => {
  if (unit === 'ms') return `${value.toFixed(2)} ms`
  if (unit === 'bytes') return `${(value / (1024 * 1024)).toFixed(2)} MB`
  return value.toFixed(2)
}

export { formatValue }
