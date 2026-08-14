// Tests for toRunFailure: the SDK's assistant-message error codes mapped to the app's vocabulary.

import { describe, expect, it } from 'vitest'
import { toRunFailure } from '../to-run-failure'

describe('toRunFailure', () => {
  it('names an expired or missing sign-in as an authentication failure', () => {
    expect(toRunFailure('authentication_failed')).toBe('authentication')
  })

  it('collapses every other SDK error to generic', () => {
    expect(toRunFailure('billing_error')).toBe('generic')
    expect(toRunFailure('rate_limit')).toBe('generic')
    expect(toRunFailure('server_error')).toBe('generic')
    expect(toRunFailure('unknown')).toBe('generic')
  })
})
