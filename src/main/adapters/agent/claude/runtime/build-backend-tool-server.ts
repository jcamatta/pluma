// Action: turn the SDK-neutral backend tools into one in-process SDK MCP server. Each tool becomes an SDK
// `tool()` whose handler runs the tool's Effect to completion in the main process and returns the
// AgentToolResult as text content. Read tools complete in-process; gated command tools suspend on the run's
// bridge for human approval before running. readOnlyHint is set per tool: queries are read-only, the gated
// mutating commands are not. The caller passes the catalog already built for the run's cwd and bridge.

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import type { McpSdkServerConfigWithInstance } from '@anthropic-ai/claude-agent-sdk'
import * as Effect from 'effect/Effect'
import type { BackendTool } from '../../tools/backend/backend-tool'
import { isMutatingBackendTool } from '../../tools/backend/is-mutating-backend-tool'
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
    { annotations: { readOnlyHint: !isMutatingBackendTool(backendTool) } }
  )

const buildBackendToolServer = (tools: readonly BackendTool[]): McpSdkServerConfigWithInstance =>
  createSdkMcpServer({
    name: TOOL_SERVER_NAME,
    version: '1.0.0',
    tools: tools.map(buildTool)
  })

export { buildBackendToolServer, TOOL_SERVER_NAME }
