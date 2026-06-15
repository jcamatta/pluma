// Tests for buildBackendToolServer: binding the SDK-neutral backend catalog to one in-process SDK MCP
// server. We stub the SDK's tool()/createSdkMcpServer to capture each tool's name, handler, and annotations,
// then drive a captured handler against a real temp .md file to prove it round-trips the use case's content.

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

type CapturedHandler = (args: Record<string, unknown>) => Promise<{ content: unknown }>

const captured: {
  toolNames: string[]
  handlers: Record<string, CapturedHandler>
  annotations: unknown[]
} = { toolNames: [], handlers: {}, annotations: [] }

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  tool: (name: string, ...rest: [string, unknown, CapturedHandler, { annotations: unknown }]) => {
    captured.toolNames.push(name)
    captured.handlers[name] = rest[2]
    captured.annotations.push(rest[3].annotations)
    return { name }
  },
  createSdkMcpServer: (options: { name: string; tools: unknown[] }) => ({
    type: 'sdk',
    name: options.name,
    toolCount: options.tools.length
  })
}))

const { buildBackendToolServer } = await import('../build-backend-tool-server')
const { backendTools } = await import('../../../tools/backend')

const withTempDir = async (body: (dir: string) => Promise<void>): Promise<void> => {
  const dir = mkdtempSync(join(tmpdir(), 'pluma-'))
  try {
    await body(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe('buildBackendToolServer', () => {
  it('binds both backend tools, all read-only', () => {
    captured.toolNames = []
    captured.annotations = []

    const server = buildBackendToolServer(backendTools('/workspace'))

    expect(server).toBeDefined()
    expect(captured.toolNames).toStrictEqual(['read_file', 'list_folder'])
    expect(captured.annotations).toStrictEqual([{ readOnlyHint: true }, { readOnlyHint: true }])
  })

  it('read_file handler returns the file contents as serialized text content', () =>
    withTempDir(async (dir) => {
      const target = join(dir, 'note.md')
      writeFileSync(target, '# Hello world')
      buildBackendToolServer(backendTools(dir))

      const result = await captured.handlers.read_file?.({ path: target })

      const output = { type: 'text', text: '# Hello world' } as const
      expect(result?.content).toStrictEqual([
        { type: 'text', text: JSON.stringify({ ok: true, output }) }
      ])
    }))
})
