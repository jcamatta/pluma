// Tests for buildOptions: the calculation mapping our RunAgentState (plus threadId) and the per-run tool
// server to the Claude SDK run options. Verifies partial messages are on, built-in tools are disabled
// (`tools: []`), the default model/effort are applied when state is absent, the threadId becomes `resume`
// when present, explicit effort/model from state override the defaults, and a provided tool server is
// registered under `mcpServers` with the no-op PreToolUse hook that holds the stream open.

import { createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk'
import { describe, expect, it } from 'vitest'
import { buildOptions } from '../build-options'

// A real (empty) SDK server config; buildOptions only forwards it by reference under mcpServers.
const toolServer = createSdkMcpServer({ name: 'pluma-frontend-tools', version: '1.0.0', tools: [] })

describe('buildOptions', () => {
  it('disables built-in tools and applies default model/effort when nothing is given', () => {
    expect(
      buildOptions({ threadId: undefined, cwd: undefined, state: undefined, toolServer: undefined })
    ).toStrictEqual({
      includePartialMessages: true,
      tools: [],
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
        toolServer: undefined
      })
    ).toStrictEqual({
      includePartialMessages: true,
      tools: [],
      model: 'claude-opus-4-8',
      effort: 'medium',
      resume: 'thread-1'
    })
  })

  it('forwards the cwd when present and omits it when absent', () => {
    const base = { threadId: undefined, state: undefined, toolServer: undefined }
    expect(buildOptions({ ...base, cwd: '/work/space' }).cwd).toBe('/work/space')
    expect('cwd' in buildOptions({ ...base, cwd: undefined })).toBe(false)
  })

  it('overrides the defaults with effort and model from the run state', () => {
    expect(
      buildOptions({
        threadId: undefined,
        cwd: undefined,
        state: { effort: 'high', model: 'claude-opus-4-8' },
        toolServer: undefined
      })
    ).toStrictEqual({
      includePartialMessages: true,
      tools: [],
      model: 'claude-opus-4-8',
      effort: 'high'
    })
  })

  it('registers a provided tool server under mcpServers with the stream-holding hook', () => {
    const options = buildOptions({
      threadId: undefined,
      cwd: undefined,
      state: undefined,
      toolServer
    })

    expect(options.mcpServers).toStrictEqual({ frontend: toolServer })
    expect(options.hooks?.PreToolUse).toHaveLength(1)
  })
})
