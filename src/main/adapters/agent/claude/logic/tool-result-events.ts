// Calculation: turn the tool_result blocks the Claude SDK echoes back (as a user message) into AG-UI
// TOOL_CALL_RESULT events (@ag-ui/core). Each result is flattened to text and tied to its tool call by
// id; the messageId is derived from that id since AG-UI requires one. Non-tool_result content yields
// nothing.

import { EventType, type ToolCallResultEvent } from '@ag-ui/core'
import type { ToolResultContent, UserContent } from '../data/sdk-types'

const toolResultText = (content: ToolResultContent): string => {
  if (content === undefined) return ''
  if (typeof content === 'string') return content
  return content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
}

export const toolResultEvents = (content: UserContent): ToolCallResultEvent[] => {
  if (typeof content === 'string') return []
  return content.flatMap((block) =>
    block.type === 'tool_result'
      ? [
          {
            type: EventType.TOOL_CALL_RESULT,
            messageId: `result-${block.tool_use_id}`,
            toolCallId: block.tool_use_id,
            content: toolResultText(block.content),
            role: 'tool'
          } satisfies ToolCallResultEvent
        ]
      : []
  )
}
