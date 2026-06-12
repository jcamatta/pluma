// formatRelativeTime is a pure calculation: given two instants and a locale it renders a stable English
// relative-time phrase, stepping through seconds/minutes/hours/days. No clock is read inside.

import { describe, expect, it } from 'vitest'
import { formatRelativeTime } from '../format-relative-time'

const now = 1_700_000_000_000
const minute = 60_000
const hour = 60 * minute
const day = 24 * hour

describe('formatRelativeTime', () => {
  it('renders seconds ago for very recent instants', () => {
    expect(formatRelativeTime({ from: now - 5_000, now, locale: 'en' })).toBe('5 seconds ago')
  })

  it('renders minutes ago', () => {
    expect(formatRelativeTime({ from: now - 3 * minute, now, locale: 'en' })).toBe('3 minutes ago')
  })

  it('renders hours ago', () => {
    expect(formatRelativeTime({ from: now - 2 * hour, now, locale: 'en' })).toBe('2 hours ago')
  })

  it('uses the natural "yesterday" wording for one day ago', () => {
    expect(formatRelativeTime({ from: now - day, now, locale: 'en' })).toBe('yesterday')
  })

  it('renders days ago for older instants', () => {
    expect(formatRelativeTime({ from: now - 4 * day, now, locale: 'en' })).toBe('4 days ago')
  })
})
