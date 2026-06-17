// Holds the composer's imperative handle in a ref and supplies focus/isFocused/register through
// ComposerFocusContext. A ref (not state, unlike ActiveEditorProvider) because consumers only *call* the
// handle on a keypress — they never render from it — so registering on mount must not trigger a
// re-render. The context value is stable; only the ref's contents change as the composer mounts/unmounts.

import { useCallback, useMemo, useRef, type ReactNode } from 'react'
import { ComposerFocusContext, type ComposerHandle } from './ComposerFocusContext'

function ComposerFocusProvider({ children }: { readonly children: ReactNode }): React.JSX.Element {
  const handle = useRef<ComposerHandle | null>(null)
  const register = useCallback((next: ComposerHandle | null) => {
    handle.current = next
  }, [])
  const focus = useCallback(() => {
    handle.current?.focus()
  }, [])
  const isFocused = useCallback(() => handle.current?.isFocused() ?? false, [])
  const value = useMemo(() => ({ focus, isFocused, register }), [focus, isFocused, register])

  return <ComposerFocusContext.Provider value={value}>{children}</ComposerFocusContext.Provider>
}

export { ComposerFocusProvider }
