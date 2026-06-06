// Type aliases narrowing the Claude Agent SDK message shapes the adapter consumes. StreamEvent is the
// raw Anthropic stream event carried by a partial-assistant message; UserContent / ToolResultContent
// model the tool_result blocks the SDK echoes back. OpenBlock tracks an in-flight content block while
// transforming. Kept in one place so the transform calculations depend on these names, not the SDK's
// deep types.

import type { SDKPartialAssistantMessage, SDKUserMessage } from '@anthropic-ai/claude-agent-sdk'

type StreamEvent = SDKPartialAssistantMessage['event']
type UserContent = SDKUserMessage['message']['content']
type ContentBlock = Exclude<UserContent, string>[number]
type ToolResultBlock = Extract<ContentBlock, { type: 'tool_result' }>
type ToolResultContent = ToolResultBlock['content']
type OpenBlock =
  | { readonly kind: 'text'; readonly messageId: string }
  | { readonly kind: 'tool'; readonly toolCallId: string }

export type { StreamEvent, UserContent, ToolResultContent, OpenBlock }
