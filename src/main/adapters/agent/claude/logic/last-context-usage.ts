// Calculation: derive the thread's current context occupancy from a stored session's message chain, for
// the resume path (showing the meter before any new run). The most recent assistant turn carries the
// usage of the last model request, which is the current context size; its `model` fixes the window. The
// stored message is `unknown`, so usage and model are read through small guards (no cast). Returns null
// when the session has no assistant turn with usage yet. Pure, so it is unit-testable without the SDK.

import type { SessionMessage } from '@anthropic-ai/claude-agent-sdk'
import type { AgentContextUsage } from '../../../../application/agent/data/context-usage'
import { contextWindowForModel } from './context-window'
import { toContextUsage, type RawUsage } from './to-context-usage'

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const numberOrNull = (value: unknown): number | null => (typeof value === 'number' ? value : null)

const readRawUsage = (value: unknown): RawUsage | undefined => {
  if (!isObject(value)) return undefined
  return {
    input_tokens: numberOrNull(value.input_tokens),
    cache_read_input_tokens: numberOrNull(value.cache_read_input_tokens),
    cache_creation_input_tokens: numberOrNull(value.cache_creation_input_tokens)
  }
}

const usageFromEntry = (entry: SessionMessage): AgentContextUsage | undefined => {
  if (entry.type !== 'assistant' || !isObject(entry.message)) return undefined
  const usage = readRawUsage(entry.message.usage)
  if (usage === undefined) return undefined
  const model = typeof entry.message.model === 'string' ? entry.message.model : ''
  return toContextUsage(usage, contextWindowForModel(model))
}

function lastContextUsageFromSession(entries: readonly SessionMessage[]): AgentContextUsage | null {
  const usages = [...entries].reverse().map(usageFromEntry)
  return usages.find((usage): usage is AgentContextUsage => usage !== undefined) ?? null
}

export { lastContextUsageFromSession }
