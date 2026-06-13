// useSettings seeds the language from localStorage and, on setLanguage, persists the choice and drives
// i18next so the whole UI re-renders in the new locale.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { i18n } from '../../i18n'
import { useSettings } from '../useSettings'

describe('useSettings language', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(async () => {
    localStorage.clear()
    await i18n.changeLanguage('en')
  })

  it('defaults to the stored language', () => {
    const { result } = renderHook(() => useSettings())
    expect(result.current.language).toBe('en')
  })

  it('persists the choice and switches i18next on setLanguage', async () => {
    const { result } = renderHook(() => useSettings())

    act(() => {
      result.current.setLanguage('es')
    })

    expect(result.current.language).toBe('es')
    expect(localStorage.getItem('pluma.language')).toBe('es')
    await waitFor(() => expect(i18n.language).toBe('es'))
  })
})
