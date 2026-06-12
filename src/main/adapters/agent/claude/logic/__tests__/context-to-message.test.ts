// Tests for contextToMessage: the calculation folding the AG-UI context entries into the opening
// user message of a fresh run. Covers the empty case (no message), the SDK envelope shape, and that
// each entry's description and value are rendered inside the <context> marker.

import { describe, expect, it } from 'vitest'
import type { AgentContextEntry } from '../../../../../application/agent/data/agent-context-entry'
import { contextToMessage } from '../context-to-message'

describe('contextToMessage', () => {
  it('returns nothing when there is no context', () => {
    expect(contextToMessage([])).toBeUndefined()
  })

  it('builds a single user-role SDK message', () => {
    const context: AgentContextEntry[] = [{ description: 'About Pluma', value: 'A writing app.' }]
    const message = contextToMessage(context)

    expect(message?.type).toBe('user')
    expect(message?.parent_tool_use_id).toBeNull()
    expect(message?.message.role).toBe('user')
  })

  it('renders each entry description and value inside the context marker', () => {
    const context: AgentContextEntry[] = [
      { description: 'About Pluma', value: 'A writing app.' },
      { description: 'Current manuscript', value: 'My Novel' }
    ]
    const content = contextToMessage(context)?.message.content

    expect(content).toBe(
      '<context>\nAbout Pluma\nA writing app.\n\nCurrent manuscript\nMy Novel\n</context>'
    )
  })
})
