import { describe, expect, it } from 'vitest'
import { formatValue } from '../format-value'

describe('formatValue', () => {
  it('renders milliseconds with two decimals and a unit', () => {
    expect(formatValue(1049.9115, 'ms')).toBe('1049.91 ms')
  })

  it('renders bytes as megabytes', () => {
    expect(formatValue(5 * 1024 * 1024, 'bytes')).toBe('5.00 MB')
  })

  it('renders a count as a plain number', () => {
    expect(formatValue(20, 'count')).toBe('20.00')
  })
})
