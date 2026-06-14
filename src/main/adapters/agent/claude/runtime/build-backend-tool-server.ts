// Action: turn the SDK-neutral backend tool catalog into one in-process SDK MCP server. Each catalog tool
// becomes an SDK `tool()` whose handler runs the tool's Effect to completion in the main process (no bridge,
// no renderer round-trip) and returns the AgentToolResult as text content. Every backend tool is a query, so
// all carry the SDK's readOnlyHint. The catalog is never empty, so this always returns a server.

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import type { McpSdkServerConfigWithInstance } from '@anthropic-ai/claude-agent-sdk'
import * as Effect from 'effect/Effect'
import { backendTools } from '../../tools/backend'
import type { BackendTool } from '../../tools/backend/backend-tool'
import { jsonSchemaToZodShape } from '../logic/json-schema-to-zod'
import { toCallToolResult } from './to-call-tool-result'

const TOOL_SERVER_NAME = 'pluma-backend-tools'

const buildTool = (backendTool: BackendTool): ReturnType<typeof tool> =>
  tool(
    backendTool.spec.name,
    backendTool.spec.description ?? '',
    jsonSchemaToZodShape(backendTool.spec.parameters),
    async (args: Record<string, unknown>) =>
      toCallToolResult(await Effect.runPromise(backendTool.run(args))),
    { annotations: { readOnlyHint: true } }
  )

const buildBackendToolServer = (cwd: string | undefined): McpSdkServerConfigWithInstance =>
  createSdkMcpServer({
    name: TOOL_SERVER_NAME,
    version: '1.0.0',
    tools: backendTools(cwd).map(buildTool)
  })

export { buildBackendToolServer, TOOL_SERVER_NAME }
