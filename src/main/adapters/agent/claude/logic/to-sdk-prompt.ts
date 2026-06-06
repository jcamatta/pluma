// Calculation: map the AG-UI conversation (Message[]) to the Claude SDK streaming-input messages. Only
// the turns Claude accepts as input are kept — user, assistant, and system — each flattened to text
// content. Other AG-UI roles (tool, reasoning, activity, developer) are not input turns and are dropped.

import type { Message } from '@ag-ui/core'
import type { SDKUserMessage } from '@anthropic-ai/claude-agent-sdk'

type SdkRole = 'user' | 'assistant' | 'system'

const sdkRole = (message: Message): SdkRole | null => {
  if (message.role === 'user') return 'user'
  if (message.role === 'assistant') return 'assistant'
  if (message.role === 'system') return 'system'
  return null
}

const textContent = (message: Message): string => {
  if (typeof message.content === 'string') return message.content
  if (message.content === undefined) return ''
  return message.content
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n')
}

const toSdkMessage = (message: Message, role: SdkRole): SDKUserMessage => ({
  type: 'user',
  parent_tool_use_id: null,
  message: { role, content: textContent(message) }
})

export const toSdkPrompt = (messages: readonly Message[]): readonly SDKUserMessage[] =>
  messages.flatMap((message) => {
    const role = sdkRole(message)
    return role === null ? [] : [toSdkMessage(message, role)]
  })
