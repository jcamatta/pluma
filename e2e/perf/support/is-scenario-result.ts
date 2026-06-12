// Validates a value parsed from a pending JSON file before it is trusted as a ScenarioResult. The
// teardown reads whatever JSON sits in the pending area, which may be stale or malformed across runs;
// this guard narrows `unknown` to the real shape so nothing downstream needs a cast, and lets the
// teardown quietly drop anything that does not match.

import { isObject } from './is-object'
import type { PerfMetric, PerfUnit, ScenarioResult } from './scenario-result'

const isPerfUnit = (value: unknown): value is PerfUnit =>
  value === 'ms' || value === 'bytes' || value === 'count'

const isNumberArray = (value: unknown): value is readonly number[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'number')

const isPerfMetric = (value: unknown): value is PerfMetric =>
  isObject(value) &&
  typeof value.name === 'string' &&
  isPerfUnit(value.unit) &&
  isNumberArray(value.samples)

const isScenarioResult = (value: unknown): value is ScenarioResult =>
  isObject(value) &&
  typeof value.scenario === 'string' &&
  typeof value.iterations === 'number' &&
  Array.isArray(value.metrics) &&
  value.metrics.every(isPerfMetric)

export { isScenarioResult }
