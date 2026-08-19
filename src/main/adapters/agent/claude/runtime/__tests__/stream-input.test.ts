// Tests for streamInput: the streaming-input prompt fed to the SDK query. On a fresh run (no threadId)
// the per-session context is yielded as the first message, ahead of the conversation; on a resume the
// context is not re-injected (the session already has it). With no context, only the conversation is
// yielded either way.

import { describe, expect, it } from 'vitest'
import type { RunAgentInput } from '../../../../../application/agent/data/run-agent-input'
import { streamInput } from '../stream-input'

const collect = async (input: RunAgentInput): Promise<readonly string[]> => {
  const contents: string[] = []
  for await (const message of streamInput(input)) {
    if (typeof message.message.content === 'string') contents.push(message.message.content)
  }
  return contents
}

const context = [{ description: 'About Pluma', value: 'A writing app.' }]
const messages = [{ id: '1', role: 'user' as const, content: 'hello' }]

describe('streamInput', () => {
  it('yields the context message first on a fresh run', async () => {
    const contents = await collect({ messages, tools: [], context })

    expect(contents).toStrictEqual(['<context>\nAbout Pluma\nA writing app.\n</context>', 'hello'])
  })

  it('does not re-inject context on a resume', async () => {
    const contents = await collect({ messages, tools: [], context, threadId: 'thread-1' })

    expect(contents).toStrictEqual(['hello'])
  })

  it('yields only the conversation when there is no context', async () => {
    const contents = await collect({ messages, tools: [] })

    expect(contents).toStrictEqual(['hello'])
  })
})

describe('streamInput · workspace root', () => {
  const cwd = 'C:\\Users\\camat\\Documents\\my-novel'

  it('states the workspace path in the opening context of a fresh run', async () => {
    const contents = await collect({ messages, tools: [], cwd })

    expect(contents[0]).toContain('<context>')
    expect(contents[0]).toContain(cwd)
  })

  it('leads the opening context with the workspace root', async () => {
    const contents = await collect({ messages, tools: [], cwd, context })

    expect(contents[0]).toBe(
      [
        '<context>',
        'The absolute path of the open workspace root. Files you create belong under it unless the user says otherwise.',
        cwd,
        '',
        'About Pluma',
        'A writing app.',
        '</context>'
      ].join('\n')
    )
  })

  it('does not re-state the workspace root on a resume', async () => {
    const contents = await collect({ messages, tools: [], cwd, threadId: 'thread-1' })

    expect(contents).toStrictEqual(['hello'])
  })
})
