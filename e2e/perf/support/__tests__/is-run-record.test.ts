import { describe, expect, it } from 'vitest'
import { isRunRecord } from '../is-run-record'

const context = { commit: 'c', version: '1.0.0', machine: 'box', timestamp: 't' }
const scenario = {
  scenario: 's',
  iterations: 1,
  metrics: [{ name: 'm', unit: 'ms', samples: [1] }]
}

describe('isRunRecord', () => {
  it('accepts a well-formed run record', () => {
    expect(isRunRecord({ context, scenarios: [scenario] })).toBe(true)
  })

  it('rejects a record with a malformed context', () => {
    expect(isRunRecord({ context: { commit: 'c' }, scenarios: [] })).toBe(false)
  })

  it('rejects a record whose scenarios are malformed', () => {
    expect(isRunRecord({ context, scenarios: [{ scenario: 's' }] })).toBe(false)
  })

  it('rejects non-objects', () => {
    expect(isRunRecord(null)).toBe(false)
    expect(isRunRecord([])).toBe(false)
  })
})
