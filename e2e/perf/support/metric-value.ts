// Safely reads a named number out of a Chrome DevTools Protocol Performance.getMetrics response, whose
// type at the Playwright CDP boundary is only `object`. Narrows the unknown shape with a guard rather
// than a cast, returning 0 when the metric is absent so a missing counter never crashes a memory sample.

import { isObject } from './is-object'

type Metric = { readonly name: string; readonly value: number }

const isMetric = (value: unknown): value is Metric =>
  isObject(value) && typeof value.name === 'string' && typeof value.value === 'number'

const isMetricList = (value: unknown): value is { readonly metrics: readonly Metric[] } =>
  isObject(value) && Array.isArray(value.metrics) && value.metrics.every(isMetric)

const metricValue = (result: unknown, name: string): number => {
  if (!isMetricList(result)) return 0
  const entry = result.metrics.find((metric) => metric.name === name)
  return entry?.value ?? 0
}

export { metricValue }
