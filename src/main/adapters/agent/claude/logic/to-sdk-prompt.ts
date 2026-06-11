// Calculation: map the AG-UI conversation (Message[]) to the Claude SDK streaming-input messages. Prior
// history is not replayed here — the SDK `resume` carries it, so re-sending it would double-count the
// conversation (and re-injecting an assistant turn as user input corrupts the resumed session). Only the
// new user input is sent: the user turns after the last assistant reply, each flattened to text content.

import type { Message } from '@ag-ui/core'
import type { SDKUserMessage } from '@anthropic-ai/claude-agent-sdk'

const textContent = (message: Message): string => {
  if (typeof message.content === 'string') return message.content
  if (message.content === undefined) return ''
  return message.content
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n')
}

const toSdkMessage = (message: Message): SDKUserMessage => ({
  type: 'user',
  parent_tool_use_id: null,
  message: { role: 'user', content: textContent(message) }
})

// The new user input: every message after the last assistant turn (the whole conversation on the first
// turn, just the latest user message once a reply has landed and the session resumes).
const newUserTurns = (messages: readonly Message[]): readonly Message[] => {
  const lastAssistant = messages.map((m) => m.role).lastIndexOf('assistant')
  return messages.slice(lastAssistant + 1).filter((message) => message.role === 'user')
}

export const toSdkPrompt = (messages: readonly Message[]): readonly SDKUserMessage[] =>
  newUserTurns(messages).map(toSdkMessage)
