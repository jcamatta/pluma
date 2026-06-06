// Tests for buildOptions: the calculation mapping our RunAgentState (plus threadId) to the Claude SDK
// run options. Verifies partial messages are on, built-in tools are disabled (`tools: []`), the default
// model/effort are applied when state is absent, the threadId becomes `resume` when present, and explicit
// effort/model from state override the defaults.

import { describe, expect, it } from 'vitest'
import { buildOptions } from '../build-options'

describe('buildOptions', () => {
  it('disables built-in tools and applies default model/effort when nothing is given', () => {
    expect(buildOptions(undefined, undefined)).toStrictEqual({
      includePartialMessages: true,
      tools: [],
      model: 'claude-opus-4-8',
      effort: 'medium'
    })
  })

  it('forwards the threadId as resume when present', () => {
    expect(buildOptions('thread-1', undefined)).toStrictEqual({
      includePartialMessages: true,
      tools: [],
      model: 'claude-opus-4-8',
      effort: 'medium',
      resume: 'thread-1'
    })
  })

  it('overrides the defaults with effort and model from the run state', () => {
    expect(buildOptions(undefined, { effort: 'high', model: 'claude-opus-4-8' })).toStrictEqual({
      includePartialMessages: true,
      tools: [],
      model: 'claude-opus-4-8',
      effort: 'high'
    })
  })
})
