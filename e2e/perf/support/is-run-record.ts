// Validates a value parsed from a runs/*.json file before it is trusted as a RunRecord. History
// accumulates across runs and app versions, so a stored file may predate the current shape; this guard
// lets the history reader drop anything malformed instead of crashing the teardown.

import { isObject } from './is-object'
import { isScenarioResult } from './is-scenario-result'
import type { RunRecord } from './assemble-run'

const isContext = (value: unknown): boolean =>
  isObject(value) &&
  typeof value.commit === 'string' &&
  typeof value.version === 'string' &&
  typeof value.machine === 'string' &&
  typeof value.timestamp === 'string'

const isRunRecord = (value: unknown): value is RunRecord =>
  isObject(value) &&
  isContext(value.context) &&
  Array.isArray(value.scenarios) &&
  value.scenarios.every(isScenarioResult)

export { isRunRecord }
