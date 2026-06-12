// Calculation: map the SDK's session message chain to AG-UI Messages the renderer can replay. Keeps
// user and assistant turns (system entries are dropped), extracting their text from the raw Anthropic
// message — a string content, or the concatenated text blocks of an array content. The raw message is
// `unknown`, so text is read through small type-guards (no casts). Turns with no text (e.g. an
// assistant turn that only called a tool) are skipped. Pure, so it is unit-testable without the SDK.

import type { Message } from '@ag-ui/core'
import type { SessionMessage } from '@anthropic-ai/claude-agent-sdk'

const asArray = (value: unknown): readonly unknown[] => (Array.isArray(value) ? value : [])

const blockText = (block: unknown): string => {
  if (typeof block !== 'object' || block === null) return ''
  if (!('type' in block) || block.type !== 'text') return ''
  return 'text' in block && typeof block.text === 'string' ? block.text : ''
}

const textFromContent = (content: unknown): string => {
  if (typeof content === 'string') return content
  return asArray(content)
    .map((block) => blockText(block))
    .join('')
}

const extractText = (message: unknown): string => {
  if (typeof message !== 'object' || message === null || !('content' in message)) return ''
  return textFromContent(message.content)
}

const toMessage = (entry: SessionMessage): Message | undefined => {
  if (entry.type !== 'user' && entry.type !== 'assistant') return undefined
  const content = extractText(entry.message)
  if (content.length === 0) return undefined
  return entry.type === 'user'
    ? { id: entry.uuid, role: 'user', content }
    : { id: entry.uuid, role: 'assistant', content }
}

export const sessionMessagesToHistory = (entries: readonly SessionMessage[]): Message[] =>
  entries.flatMap((entry) => {
    const message = toMessage(entry)
    return message === undefined ? [] : [message]
  })
