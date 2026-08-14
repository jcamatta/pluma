// Tests for toAgentRunFailure: the one place a RUN_ERROR `code` — read off a passthrough event, so
// typed `unknown` — is narrowed to the closed failure vocabulary.

import { describe, expect, it } from 'vitest'
import { toAgentRunFailure } from '../agent-run-failure'

describe('toAgentRunFailure', () => {
  it('keeps a code the app handles specially', () => {
    expect(toAgentRunFailure('authentication')).toBe('authentication')
  })

  it('keeps the generic code', () => {
    expect(toAgentRunFailure('generic')).toBe('generic')
  })

  it('falls back to generic for a string outside the vocabulary', () => {
    expect(toAgentRunFailure('billing_error')).toBe('generic')
  })

  it('falls back to generic when no code was stamped', () => {
    expect(toAgentRunFailure(undefined)).toBe('generic')
  })

  it('falls back to generic for a non-string value', () => {
    expect(toAgentRunFailure(42)).toBe('generic')
    expect(toAgentRunFailure(null)).toBe('generic')
    expect(toAgentRunFailure({ code: 'authentication' })).toBe('generic')
  })
})
