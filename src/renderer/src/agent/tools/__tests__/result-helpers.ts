// Test helpers: narrow an AgentToolResult to its json output and pull a string field out, failing
// the test on any shape that the success path should never produce. Keeps each test's assertions
// flat (below the complexity cap) and free of casts. `expect.fail` returns never, so it both aborts
// the test and narrows the type for the lines that follow.

import { expect } from 'vitest'
import type { AgentToolResult } from '../types'

function jsonValue(result: AgentToolResult): Record<string, unknown> {
  if (!result.ok || result.output.type !== 'json') return expect.fail('expected json output')
  const value = result.output.value
  if (typeof value !== 'object' || value === null) return expect.fail('expected object value')
  return { ...value }
}

function stringField(result: AgentToolResult, key: string): string {
  const field = jsonValue(result)[key]
  if (typeof field !== 'string') return expect.fail(`expected string field ${key}`)
  return field
}

export { jsonValue, stringField }
