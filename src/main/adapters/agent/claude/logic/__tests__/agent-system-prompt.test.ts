// Tests for AGENT_SYSTEM_PROMPT: the custom system prompt is non-empty and states the writing-assistant
// identity — it names Pluma, says what the agent is (a writing assistant in a chat panel), bounds its
// scope to writing (explicitly not a coding assistant), and ties its actions to the run's tools.

import { describe, expect, it } from 'vitest'
import { AGENT_SYSTEM_PROMPT } from '../agent-system-prompt'

describe('AGENT_SYSTEM_PROMPT', () => {
  it('is a non-empty prompt', () => {
    expect(AGENT_SYSTEM_PROMPT.length).toBeGreaterThan(0)
  })

  it('states the Pluma writing-assistant identity', () => {
    expect(AGENT_SYSTEM_PROMPT).toContain('Pluma')
    expect(AGENT_SYSTEM_PROMPT).toContain('writing assistant')
  })

  it('names the surface the agent lives in', () => {
    expect(AGENT_SYSTEM_PROMPT).toContain('chat panel')
  })

  it('bounds the scope to writing, not coding', () => {
    expect(AGENT_SYSTEM_PROMPT).toContain('not a coding assistant')
  })

  it('ties manuscript actions to the tools offered in the run', () => {
    expect(AGENT_SYSTEM_PROMPT).toContain('tools offered in this run')
  })
})
