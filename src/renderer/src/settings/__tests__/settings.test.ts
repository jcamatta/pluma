// settings.ts is the localStorage <-> data-theme bridge. These cover the round trip: what loadSettings
// reads back, that saveTheme both persists and writes the document attribute, that "system" clears the
// override, and that initSettings applies the stored choice.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { applyTheme, initSettings, loadSettings, saveTheme } from '../settings'

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

afterEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

describe('settings', () => {
  it('defaults to the system theme when nothing is stored', () => {
    expect(loadSettings()).toEqual({ theme: 'system' })
  })

  it('falls back to system when an invalid theme is stored', () => {
    localStorage.setItem('pluma.theme', 'sepia')
    expect(loadSettings()).toEqual({ theme: 'system' })
  })

  it('persists and applies an explicit theme', () => {
    saveTheme('dark')
    expect(localStorage.getItem('pluma.theme')).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(loadSettings()).toEqual({ theme: 'dark' })
  })

  it('clears the data-theme override for the system theme', () => {
    applyTheme('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    applyTheme('system')
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })

  it('applies the stored theme on init', () => {
    localStorage.setItem('pluma.theme', 'light')
    expect(initSettings()).toEqual({ theme: 'light' })
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })
})
