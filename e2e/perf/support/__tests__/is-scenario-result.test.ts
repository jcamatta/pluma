import { describe, expect, it } from 'vitest'
import { isScenarioResult } from '../is-scenario-result'

const valid = {
  scenario: 'cold-start',
  iterations: 2,
  metrics: [{ name: 'launch', unit: 'ms', samples: [1, 2] }]
}

describe('isScenarioResult', () => {
  it('accepts a well-formed result', () => {
    expect(isScenarioResult(valid)).toBe(true)
  })

  it('accepts a result with no metrics', () => {
    expect(isScenarioResult({ scenario: 's', iterations: 0, metrics: [] })).toBe(true)
  })

  it('rejects non-objects', () => {
    expect(isScenarioResult(null)).toBe(false)
    expect(isScenarioResult('x')).toBe(false)
    expect(isScenarioResult(undefined)).toBe(false)
  })

  it('rejects a bad unit', () => {
    expect(
      isScenarioResult({ ...valid, metrics: [{ name: 'm', unit: 'seconds', samples: [1] }] })
    ).toBe(false)
  })

  it('rejects non-numeric samples', () => {
    expect(
      isScenarioResult({ ...valid, metrics: [{ name: 'm', unit: 'ms', samples: ['1'] }] })
    ).toBe(false)
  })

  it('rejects missing fields', () => {
    expect(isScenarioResult({ scenario: 's', metrics: [] })).toBe(false)
    expect(isScenarioResult({ iterations: 1, metrics: [] })).toBe(false)
  })
})
