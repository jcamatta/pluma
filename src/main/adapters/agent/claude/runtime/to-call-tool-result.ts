import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { AgentToolResult } from '../../../../application/agent/data/agent-tool'

const toCallToolResult = (result: AgentToolResult): CallToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(result) }]
})

export { toCallToolResult }
