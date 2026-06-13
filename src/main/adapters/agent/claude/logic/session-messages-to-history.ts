// Calculation: map the SDK's session message chain to AG-UI Messages the renderer can replay. Keeps
// user and assistant turns (system entries are dropped) and reconstructs their tool activity: an
// assistant turn carries its text plus a toolCalls[] read from tool_use blocks; a user turn that echoes
// tool_result blocks becomes one `tool` message per result (linked by toolCallId), not a user bubble.
// This is the same information apply() builds from the live stream; the renderer projection normalizes
// the two shapes. The raw message is `unknown`, so every field is read through small type-guards (no
// casts). Turns with neither text nor tool activity are skipped. Pure, so it is unit-testable without
// the SDK.

import type { Message, ToolCall } from '@ag-ui/core'
import type { SessionMessage } from '@anthropic-ai/claude-agent-sdk'

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const stringProp = (value: unknown, key: string): string => {
  if (!isObject(value)) return ''
  const found = value[key]
  return typeof found === 'string' ? found : ''
}

const asArray = (value: unknown): readonly unknown[] => (Array.isArray(value) ? value : [])

const contentOf = (message: unknown): unknown =>
  isObject(message) && 'content' in message ? message.content : undefined

const blockText = (block: unknown): string =>
  stringProp(block, 'type') === 'text' ? stringProp(block, 'text') : ''

const textFromContent = (content: unknown): string => {
  if (typeof content === 'string') return content
  return asArray(content)
    .map((block) => blockText(block))
    .join('')
}

const toolCallFromBlock = (block: unknown): readonly ToolCall[] => {
  const id = stringProp(block, 'id')
  if (stringProp(block, 'type') !== 'tool_use' || id.length === 0) return []
  const name = stringProp(block, 'name')
  const input = isObject(block) && 'input' in block ? block.input : {}
  return [{ id, type: 'function', function: { name, arguments: JSON.stringify(input) } }]
}

const toolMessageFromBlock = (block: unknown): readonly Message[] => {
  const toolUseId = stringProp(block, 'tool_use_id')
  if (stringProp(block, 'type') !== 'tool_result' || toolUseId.length === 0) return []
  const content = isObject(block) && 'content' in block ? textFromContent(block.content) : ''
  return [{ id: `result-${toolUseId}`, role: 'tool', toolCallId: toolUseId, content }]
}

const assistantMessages = (entry: SessionMessage): readonly Message[] => {
  const content = textFromContent(contentOf(entry.message))
  const toolCalls = asArray(contentOf(entry.message)).flatMap(toolCallFromBlock)
  if (content.length === 0 && toolCalls.length === 0) return []
  const base = { id: entry.uuid, role: 'assistant' as const, content }
  return [toolCalls.length === 0 ? base : { ...base, toolCalls }]
}

const userMessages = (entry: SessionMessage): readonly Message[] => {
  const toolMessages = asArray(contentOf(entry.message)).flatMap(toolMessageFromBlock)
  if (toolMessages.length > 0) return toolMessages
  const content = textFromContent(contentOf(entry.message))
  return content.length === 0 ? [] : [{ id: entry.uuid, role: 'user', content }]
}

const toMessages = (entry: SessionMessage): readonly Message[] => {
  if (entry.type === 'assistant') return assistantMessages(entry)
  if (entry.type === 'user') return userMessages(entry)
  return []
}

export const sessionMessagesToHistory = (entries: readonly SessionMessage[]): Message[] =>
  entries.flatMap(toMessages)
