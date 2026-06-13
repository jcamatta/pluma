// settings.ts is the localStorage <-> data-theme bridge. These cover the round trip: what loadSettings
// reads back, that saveTheme both persists and writes the document attribute, that "system" clears the
// override, and that initSettings applies the stored choice.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  applyTheme,
  initSettings,
  isLanguage,
  loadLanguage,
  loadSettings,
  saveLanguage,
  saveTheme
} from '../settings'

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
    expect(loadSettings()).toEqual({ theme: 'system', language: 'en' })
  })

  it('falls back to system when an invalid theme is stored', () => {
    localStorage.setItem('pluma.theme', 'sepia')
    expect(loadSettings()).toEqual({ theme: 'system', language: 'en' })
  })

  it('persists and applies an explicit theme', () => {
    saveTheme('dark')
    expect(localStorage.getItem('pluma.theme')).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(loadSettings()).toEqual({ theme: 'dark', language: 'en' })
  })

  it('clears the data-theme override for the system theme', () => {
    applyTheme('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    applyTheme('system')
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })

  it('applies the stored theme on init', () => {
    localStorage.setItem('pluma.theme', 'light')
    expect(initSettings()).toEqual({ theme: 'light', language: 'en' })
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })
})

describe('language settings', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults to en when nothing is stored', () => {
    expect(loadLanguage()).toBe('en')
  })

  it('round-trips a saved language', () => {
    saveLanguage('es')
    expect(localStorage.getItem('pluma.language')).toBe('es')
    expect(loadLanguage()).toBe('es')
  })

  it('falls back to en for an unknown stored value', () => {
    localStorage.setItem('pluma.language', 'fr')
    expect(loadLanguage()).toBe('en')
  })

  it('guards the Language union', () => {
    expect(isLanguage('es')).toBe(true)
    expect(isLanguage('fr')).toBe(false)
    expect(isLanguage(null)).toBe(false)
  })
})
