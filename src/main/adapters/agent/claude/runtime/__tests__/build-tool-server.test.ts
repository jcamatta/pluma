// Tests for buildToolServer: turning renderer tool specs into one in-process SDK MCP server whose tool
// handlers suspend on the bridge. We stub the SDK's tool()/createSdkMcpServer so we can capture the
// generated handler and assert it round-trips: calling it emits an AgentToolCall through the bridge and
// returns the renderer's result serialized as text content. An empty spec list yields no server.

import { describe, expect, it, vi } from 'vitest'
import type { Tool } from '@ag-ui/core'
import { createToolBridge } from '../tool-bridge'

type CapturedHandler = (args: Record<string, unknown>) => Promise<{ content: unknown }>

const captured: { handler?: CapturedHandler; toolNames: string[] } = { toolNames: [] }

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  tool: (name: string, ...rest: [string, unknown, CapturedHandler]) => {
    captured.toolNames.push(name)
    captured.handler = rest[2]
    return { name }
  },
  createSdkMcpServer: (options: { name: string; tools: unknown[] }) => ({
    type: 'sdk',
    name: options.name,
    toolCount: options.tools.length
  })
}))

const { buildToolServer } = await import('../build-tool-server')

const proposeEdit: Tool = {
  name: 'propose_edit',
  description: 'Propose a replacement.',
  parameters: { type: 'object', properties: { rangeId: { type: 'string' } }, required: ['rangeId'] }
}

describe('buildToolServer', () => {
  it('returns undefined when there are no tools', () => {
    expect(
      buildToolServer([], { bridge: createToolBridge(vi.fn()), runId: 'run-1' })
    ).toBeUndefined()
  })

  it('generates one SDK tool per spec', () => {
    captured.toolNames = []
    const server = buildToolServer([proposeEdit], {
      bridge: createToolBridge(vi.fn()),
      runId: 'run-1'
    })

    expect(server).toBeDefined()
    expect(captured.toolNames).toStrictEqual(['propose_edit'])
  })

  it('routes a tool call through the bridge and returns the result as text content', async () => {
    const send = vi.fn()
    const bridge = createToolBridge(send)
    buildToolServer([proposeEdit], { bridge, runId: 'run-1' })

    const settled = captured.handler?.({ rangeId: 'r1' })
    const emitted = send.mock.calls[0]?.[0]

    expect(emitted).toMatchObject({
      runId: 'run-1',
      toolName: 'propose_edit',
      args: { rangeId: 'r1' }
    })

    const output = { type: 'text', text: 'proposed' } as const
    bridge.resolve(emitted.toolCallId, { ok: true, output })
    const result = await settled

    expect(result?.content).toStrictEqual([
      { type: 'text', text: JSON.stringify({ ok: true, output }) }
    ])
  })
})
