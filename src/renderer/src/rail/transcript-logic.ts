// Pure calculation: split the agent's conversation (agent.messages) into the settled history the rail
// renders as plain bubbles and the current turn's prompt, which the live activity renders instead. While
// a run is live, the current turn is everything from the last user message onward (its streamed reply is
// shown by the activity, not as a settled bubble); the history is everything before it. With no live run
// the whole conversation is history (e.g. a freshly loaded thread). User and non-empty assistant turns
// are kept; tool/system/empty turns are internal. Same input → same output; no React, no IO.

import type { Message } from '@ag-ui/core'

type TranscriptRole = 'user' | 'assistant'

interface TranscriptItem {
  readonly id: string
  readonly role: TranscriptRole
  readonly text: string
}

interface ConversationSplit {
  readonly history: readonly TranscriptItem[]
  readonly currentPrompt: string | null
}

function toItem(message: Message): readonly TranscriptItem[] {
  if (message.role !== 'user' && message.role !== 'assistant') return []
  const text = typeof message.content === 'string' ? message.content.trim() : ''
  if (text.length === 0) return []
  return [{ id: message.id, role: message.role, text }]
}

function lastUserIndex(messages: readonly Message[]): number {
  const fromEnd = [...messages].reverse().findIndex((message) => message.role === 'user')
  return fromEnd === -1 ? -1 : messages.length - 1 - fromEnd
}

function splitConversation(messages: readonly Message[], live: boolean): ConversationSplit {
  const boundary = live ? lastUserIndex(messages) : -1
  if (boundary === -1) return { history: messages.flatMap(toItem), currentPrompt: null }
  const current = messages[boundary]
  const prompt = typeof current.content === 'string' ? current.content.trim() : ''
  return { history: messages.slice(0, boundary).flatMap(toItem), currentPrompt: prompt }
}

export { splitConversation }
export type { ConversationSplit, TranscriptItem, TranscriptRole }
