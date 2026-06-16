import { describe, expect, it } from 'vitest'
import { metricValue } from '../metric-value'

const response = {
  metrics: [
    { name: 'JSHeapUsedSize', value: 12_345 },
    { name: 'Nodes', value: 678 }
  ]
}

describe('metricValue', () => {
  it('reads a named metric value', () => {
    expect(metricValue(response, 'JSHeapUsedSize')).toBe(12_345)
  })

  it('returns 0 for an absent metric', () => {
    expect(metricValue(response, 'Missing')).toBe(0)
  })

  it('returns 0 for a malformed response', () => {
    expect(metricValue(null, 'JSHeapUsedSize')).toBe(0)
    expect(metricValue({ metrics: 'nope' }, 'JSHeapUsedSize')).toBe(0)
    expect(metricValue({ metrics: [{ name: 'x' }] }, 'x')).toBe(0)
  })
})
