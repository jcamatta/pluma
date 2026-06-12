// Calculation: fold the per-session AG-UI context entries into the single opening message of a fresh
// run. The SDK streaming-input channel carries only user-role messages (the system role is owned by the
// `systemPrompt` option), so the context is delivered as the first user message, wrapped in a <context>
// marker and with each entry rendered as its `description` then its `value`. Returns nothing when there
// is no context, so the caller prepends only when there is something to load.

import type { SDKUserMessage } from '@anthropic-ai/claude-agent-sdk'
import type { AgentContextEntry } from '../../../../application/agent/data/agent-context-entry'

const renderEntry = (entry: AgentContextEntry): string => `${entry.description}\n${entry.value}`

const renderContext = (context: readonly AgentContextEntry[]): string =>
  ['<context>', context.map(renderEntry).join('\n\n'), '</context>'].join('\n')

const contextToMessage = (context: readonly AgentContextEntry[]): SDKUserMessage | undefined =>
  context.length === 0
    ? undefined
    : {
        type: 'user',
        parent_tool_use_id: null,
        message: { role: 'user', content: renderContext(context) }
      }

export { contextToMessage }
