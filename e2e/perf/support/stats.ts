// Pure summary statistics over a set of samples. A scenario runs many iterations and we never report a
// single number: `summarize` reduces the raw samples to the figures the report shows — the median (the
// typical run) and p95 (the tail a user occasionally hits), plus min/max and the sample count for
// context. Quantiles use linear interpolation between order statistics (the R-7 / numpy default), so
// p50 of [1,2,3,4,5] is 3 and p95 is 4.8.

type Summary = {
  readonly count: number
  readonly min: number
  readonly median: number
  readonly p95: number
  readonly max: number
}

const empty: Summary = { count: 0, min: 0, median: 0, p95: 0, max: 0 }

const quantile = (sorted: readonly number[], q: number): number => {
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return sorted[lo] + (pos - lo) * (sorted[hi] - sorted[lo])
}

const summarize = (samples: readonly number[]): Summary => {
  if (samples.length === 0) return empty
  const sorted = [...samples].sort((a, b) => a - b)
  return {
    count: sorted.length,
    min: sorted[0],
    median: quantile(sorted, 0.5),
    p95: quantile(sorted, 0.95),
    max: sorted[sorted.length - 1]
  }
}

export { summarize, type Summary }
