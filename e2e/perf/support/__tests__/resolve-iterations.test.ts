import { describe, expect, it } from 'vitest'
import { resolveIterations, DEFAULT_ITERATIONS } from '../resolve-iterations'

describe('resolveIterations', () => {
  it('parses a positive integer string', () => {
    expect(resolveIterations('3')).toBe(3)
  })

  it('falls back to the default when unset', () => {
    expect(resolveIterations(undefined)).toBe(DEFAULT_ITERATIONS)
  })

  it('falls back for non-numeric, zero, negative and fractional values', () => {
    expect(resolveIterations('abc')).toBe(DEFAULT_ITERATIONS)
    expect(resolveIterations('')).toBe(DEFAULT_ITERATIONS)
    expect(resolveIterations('0')).toBe(DEFAULT_ITERATIONS)
    expect(resolveIterations('-2')).toBe(DEFAULT_ITERATIONS)
    expect(resolveIterations('2.5')).toBe(DEFAULT_ITERATIONS)
  })
})
