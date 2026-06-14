// Tests for buildOptions: the calculation mapping our RunAgentState (plus threadId) and the per-run tool
// server to the Claude SDK run options. Verifies partial messages are on, built-in tools are disabled
// (`tools: []`), the default model/effort are applied when state is absent, the threadId becomes `resume`
// when present, explicit effort/model from state override the defaults, the custom writing-assistant
// system prompt is always set, and a provided tool server is registered under `mcpServers` with the
// no-op PreToolUse hook that holds the stream open and the frontend tools on the permission allow-list.

import { createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk'
import type { Tool } from '@ag-ui/core'
import { describe, expect, it } from 'vitest'
import { AGENT_SYSTEM_PROMPT } from '../agent-system-prompt'
import { buildOptions, frontendAllowedTools } from '../build-options'

// A real (empty) SDK server config; buildOptions only forwards it by reference under mcpServers.
const toolServer = createSdkMcpServer({ name: 'pluma-frontend-tools', version: '1.0.0', tools: [] })

const spec = (name: string): Tool => ({
  name,
  description: '',
  parameters: { type: 'object', properties: {} }
})

describe('buildOptions', () => {
  it('disables built-in tools and applies default model/effort when nothing is given', () => {
    expect(
      buildOptions({
        threadId: undefined,
        cwd: undefined,
        state: undefined,
        toolServer: undefined,
        tools: []
      })
    ).toStrictEqual({
      includePartialMessages: true,
      tools: [],
      systemPrompt: AGENT_SYSTEM_PROMPT,
      model: 'claude-opus-4-8',
      effort: 'medium'
    })
  })

  it('forwards the threadId as resume when present', () => {
    expect(
      buildOptions({
        threadId: 'thread-1',
        cwd: undefined,
        state: undefined,
        toolServer: undefined,
        tools: []
      })
    ).toStrictEqual({
      includePartialMessages: true,
      tools: [],
      systemPrompt: AGENT_SYSTEM_PROMPT,
      model: 'claude-opus-4-8',
      effort: 'medium',
      resume: 'thread-1'
    })
  })

  it('forwards the cwd when present and omits it when absent', () => {
    const base = { threadId: undefined, state: undefined, toolServer: undefined, tools: [] }
    expect(buildOptions({ ...base, cwd: '/work/space' }).cwd).toBe('/work/space')
    expect('cwd' in buildOptions({ ...base, cwd: undefined })).toBe(false)
  })

  it('overrides the defaults with effort and model from the run state', () => {
    expect(
      buildOptions({
        threadId: undefined,
        cwd: undefined,
        state: { effort: 'high', model: 'claude-opus-4-8' },
        toolServer: undefined,
        tools: []
      })
    ).toStrictEqual({
      includePartialMessages: true,
      tools: [],
      systemPrompt: AGENT_SYSTEM_PROMPT,
      model: 'claude-opus-4-8',
      effort: 'high'
    })
  })
})

describe('buildOptions · model selection', () => {
  it('honors the sonnet model from the run state', () => {
    expect(
      buildOptions({
        threadId: undefined,
        cwd: undefined,
        state: { effort: 'low', model: 'claude-sonnet-4-6' },
        toolServer: undefined,
        tools: []
      })
    ).toStrictEqual({
      includePartialMessages: true,
      tools: [],
      systemPrompt: AGENT_SYSTEM_PROMPT,
      model: 'claude-sonnet-4-6',
      effort: 'low'
    })
  })
})

describe('buildOptions · tool permissions', () => {
  it('registers the tool server with the stream-holding hook and the frontend permission allow-list', () => {
    const options = buildOptions({
      threadId: undefined,
      cwd: undefined,
      state: undefined,
      toolServer,
      tools: [spec('get_content'), spec('propose_edit')]
    })

    expect(options.mcpServers).toStrictEqual({ frontend: toolServer })
    expect(options.hooks?.PreToolUse).toHaveLength(1)
    expect(options.allowedTools).toStrictEqual([
      'mcp__frontend__get_content',
      'mcp__frontend__propose_edit'
    ])
  })

  it('omits the allow-list when no tool server is offered', () => {
    const options = buildOptions({
      threadId: undefined,
      cwd: undefined,
      state: undefined,
      toolServer: undefined,
      tools: [spec('get_content')]
    })

    expect('allowedTools' in options).toBe(false)
  })
})

describe('frontendAllowedTools', () => {
  it('namespaces each tool name under the frontend MCP server', () => {
    expect(frontendAllowedTools([spec('get_content'), spec('create_annotation')])).toStrictEqual([
      'mcp__frontend__get_content',
      'mcp__frontend__create_annotation'
    ])
  })
})
