// ComposerFocusProvider is the seam the Ctrl/Cmd+K shortcut uses to focus the composer without reaching
// across the tree with the DOM: a mounted ComposerField registers its textarea, and focus()/isFocused()
// delegate to it. Reading the context outside a provider is a usage error.

import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { act, renderHook, screen } from '@testing-library/react'
import { ComposerFocusProvider } from '../ComposerFocusProvider'
import { ComposerField } from '../ComposerField'
import { useComposerFocus } from '../ComposerFocusContext'

const noop = (): void => undefined

function provider({ children }: { readonly children: ReactNode }): React.JSX.Element {
  return <ComposerFocusProvider>{children}</ComposerFocusProvider>
}

// Wraps the hook under test alongside a real ComposerField, so both share one provider and the hook reads
// the handle the field registers.
function withComposer({ children }: { readonly children: ReactNode }): React.JSX.Element {
  return (
    <ComposerFocusProvider>
      <ComposerField placeholder="Ask…" value="" onChange={noop} onKeyDown={noop} />
      {children}
    </ComposerFocusProvider>
  )
}

describe('ComposerFocusProvider', () => {
  it('focuses the registered composer textarea and reports its focus state', () => {
    const { result } = renderHook(useComposerFocus, { wrapper: withComposer })
    const textarea = screen.getByPlaceholderText('Ask…')

    expect(result.current.isFocused()).toBe(false)

    act(() => result.current.focus())
    expect(textarea).toHaveFocus()
    expect(result.current.isFocused()).toBe(true)
  })

  it('delegates to whatever handle is registered, and reports unfocused once cleared', () => {
    const { result } = renderHook(useComposerFocus, { wrapper: provider })
    const focus = vi.fn()

    expect(result.current.isFocused()).toBe(false)

    act(() => result.current.register({ focus, isFocused: () => true }))
    expect(result.current.isFocused()).toBe(true)
    result.current.focus()
    expect(focus).toHaveBeenCalledOnce()

    act(() => result.current.register(null))
    expect(result.current.isFocused()).toBe(false)
  })

  it('throws when used outside a ComposerFocusProvider', () => {
    expect(() => renderHook(useComposerFocus)).toThrow()
  })
})
