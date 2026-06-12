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

  it('lifts forwardedProps.cwd to a top-level cwd', () => {
    const result = toRunInput({ ...base, forwardedProps: { cwd: '/work/space' } })
    expect(result.cwd).toBe('/work/space')
  })

  it('omits cwd when forwardedProps has none', () => {
    expect('cwd' in toRunInput(base)).toBe(false)
    expect('cwd' in toRunInput({ ...base, forwardedProps: { cwd: '' } })).toBe(false)
  })

  it('lifts forwardedProps.state (model/effort) to a top-level state', () => {
    const result = toRunInput({
      ...base,
      forwardedProps: { state: { model: 'claude-sonnet-4-6', effort: 'high' } }
    })
    expect(result.state).toEqual({ model: 'claude-sonnet-4-6', effort: 'high' })
  })

  it('omits state when forwardedProps has none or it is all invalid', () => {
    expect('state' in toRunInput(base)).toBe(false)
    expect('state' in toRunInput({ ...base, forwardedProps: { state: { model: 'nope' } } })).toBe(
      false
    )
  })
})
