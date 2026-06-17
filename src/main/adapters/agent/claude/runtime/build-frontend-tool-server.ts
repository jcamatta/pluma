// Action: turn the renderer-supplied tool specs (AG-UI Tool, JSON-Schema parameters) into one in-process
// SDK MCP server. Each spec becomes an SDK `tool()` whose handler does not act on the editor itself (it
// can't — the editor is in the renderer); instead it mints a toolCallId, asks the bridge to run the tool
// in the renderer, awaits the AgentToolResult, and returns it as the tool's text content. The bridge is
// the suspend point that keeps the SDK query paused until the renderer answers. An empty tools list yields
// no server (undefined), so a run with no frontend tools is offered none.

import { randomUUID } from 'node:crypto'
import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import type { McpSdkServerConfigWithInstance } from '@anthropic-ai/claude-agent-sdk'
import type { Tool } from '@ag-ui/core'
import { jsonSchemaToZodShape } from '../logic/json-schema-to-zod'
import { toCallToolResult } from './to-call-tool-result'
import type { ToolBridge } from '../../tools/tool-bridge'

const TOOL_SERVER_NAME = 'pluma-frontend-tools'

// The tools that only read the editor (no mutation). They carry the SDK's `readOnlyHint` so the model and
// permission system know they are side-effect-free; the others (create_annotation, propose_edit) mutate.
const READ_ONLY_TOOLS: ReadonlySet<string> = new Set(['get_current_selection'])

// What a generated tool handler needs to suspend on the renderer: the bridge to route the call through
// and the runId to stamp on it.
interface ToolContext {
  readonly bridge: ToolBridge
  readonly runId: string
}

const buildTool = (spec: Tool, context: ToolContext): ReturnType<typeof tool> =>
  tool(
    spec.name,
    spec.description ?? '',
    jsonSchemaToZodShape(spec.parameters),
    async (args: Record<string, unknown>) => {
      const result = await context.bridge.callTool({
        runId: context.runId,
        toolCallId: randomUUID(),
        toolName: spec.name,
        args
      })
      return toCallToolResult(result)
    },
    { annotations: { readOnlyHint: READ_ONLY_TOOLS.has(spec.name) } }
  )

const buildFrontendToolServer = (
  tools: readonly Tool[],
  context: ToolContext
): McpSdkServerConfigWithInstance | undefined => {
  if (tools.length === 0) return undefined
  return createSdkMcpServer({
    name: TOOL_SERVER_NAME,
    version: '1.0.0',
    tools: tools.map((spec) => buildTool(spec, context))
  })
}

export { buildFrontendToolServer, TOOL_SERVER_NAME, type ToolContext }
