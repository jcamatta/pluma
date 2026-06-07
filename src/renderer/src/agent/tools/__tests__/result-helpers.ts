// Test helpers: narrow an AgentToolResult to its json output and pull a string field out, throwing
// on any shape that the success path should never produce. Keeps each test's assertions flat (below
// the complexity cap) and free of casts.

import type { AgentToolResult } from '../types'

function jsonValue(result: AgentToolResult): Record<string, unknown> {
  if (!result.ok || result.output.type !== 'json') throw new Error('expected json output')
  const value = result.output.value
  if (typeof value !== 'object' || value === null) throw new Error('expected object value')
  return { ...value }
}

function stringField(result: AgentToolResult, key: string): string {
  const field = jsonValue(result)[key]
  if (typeof field !== 'string') throw new Error(`expected string field ${key}`)
  return field
}

export { jsonValue, stringField }
