import { describe, expect, it } from 'vitest'
import { summarize } from '../stats'

describe('summarize', () => {
  it('reports count, min, median and max over the samples', () => {
    const result = summarize([5, 1, 3, 2, 4])
    expect(result.count).toBe(5)
    expect(result.min).toBe(1)
    expect(result.max).toBe(5)
    expect(result.median).toBe(3)
  })

  it('computes p95 by linear interpolation (R-7)', () => {
    expect(summarize([1, 2, 3, 4, 5]).p95).toBeCloseTo(4.8, 10)
  })

  it('averages the two middle values for an even-sized set', () => {
    expect(summarize([1, 2, 3, 4]).median).toBe(2.5)
  })

  it('returns the lone value for a single sample', () => {
    expect(summarize([42])).toEqual({ count: 1, min: 42, median: 42, p95: 42, max: 42 })
  })

  it('does not mutate the input order', () => {
    const input = [3, 1, 2]
    summarize(input)
    expect(input).toEqual([3, 1, 2])
  })

  it('returns a zeroed summary with count 0 for no samples', () => {
    expect(summarize([])).toEqual({ count: 0, min: 0, median: 0, p95: 0, max: 0 })
  })
})
