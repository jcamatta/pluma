// toRunInput: messages, tools, and context pass through; threadId is included only when present.

import { describe, expect, it } from 'vitest'
import type { RunAgentInput } from '@ag-ui/client'
import { toRunInput } from '../to-run-input'

const base: RunAgentInput = {
  threadId: '',
  runId: 'run-1',
  messages: [{ id: 'm1', role: 'user', content: 'hi' }],
  tools: [{ name: 'echo', description: 'echo', parameters: {} }],
  context: [],
  forwardedProps: {},
  state: {}
}

describe('toRunInput', () => {
  it('passes messages and tools through', () => {
    const result = toRunInput(base)
    expect(result.messages).toEqual(base.messages)
    expect(result.tools).toEqual(base.tools)
  })

  it('passes the AG-UI context through', () => {
    const context = [{ description: 'About Pluma', value: 'A writing app.' }]
    expect(toRunInput({ ...base, context }).context).toEqual(context)
  })

  it('omits threadId when empty', () => {
    expect('threadId' in toRunInput(base)).toBe(false)
  })

  it('includes threadId when present', () => {
    const result = toRunInput({ ...base, threadId: 'thread-9' })
    expect(result.threadId).toBe('thread-9')
  })
})
