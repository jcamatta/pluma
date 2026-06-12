// useRunControls: starts on the defaults (Opus 4.8 / medium), narrows a Select's raw value back to the
// typed union before storing it (ignoring strays), and exposes the current selection as the RunAgentState
// the controller stamps on the next run.

import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { i18n } from '../../i18n'
import { useRunControls } from '../useRunControls'

function wrapper({ children }: { readonly children: ReactNode }): React.JSX.Element {
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
}

describe('useRunControls', () => {
  it('defaults to opus 4.8 and medium', () => {
    const { result } = renderHook(() => useRunControls(), { wrapper })
    expect(result.current.runState).toEqual({ model: 'claude-opus-4-8', effort: 'medium' })
    expect(result.current.model.value).toBe('claude-opus-4-8')
    expect(result.current.effort.value).toBe('medium')
  })

  it('updates the run state when a valid model and effort are chosen', () => {
    const { result } = renderHook(() => useRunControls(), { wrapper })
    act(() => result.current.model.onValueChange('claude-sonnet-4-6'))
    act(() => result.current.effort.onValueChange('high'))
    expect(result.current.runState).toEqual({ model: 'claude-sonnet-4-6', effort: 'high' })
  })

  it('ignores a value outside the typed union', () => {
    const { result } = renderHook(() => useRunControls(), { wrapper })
    act(() => result.current.model.onValueChange('gpt-4'))
    expect(result.current.runState.model).toBe('claude-opus-4-8')
  })
})
