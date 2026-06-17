// Context carrying an imperative handle to the chat composer's textarea, so the shell can focus it (or
// ask whether it holds focus) without reaching across the component tree with the DOM. The composer
// lives deep in the rail and registers its handle on mount, clearing it on unmount; consumers (the
// Ctrl/Cmd+K shortcut) call `focus`/`isFocused`, which delegate to whatever is registered. Mirrors
// ActiveEditorContext, the editor column's equivalent seam — the sanctioned way to drive a sibling
// component imperatively instead of querySelector.

import { createContext, useContext } from 'react'
import { invariant } from '../../../shared/invariant'

interface ComposerHandle {
  readonly focus: () => void
  readonly isFocused: () => boolean
}

interface ComposerFocus {
  // Focus the composer textarea if one is mounted; a no-op otherwise.
  readonly focus: () => void
  // Whether the composer textarea currently holds focus (false when none is mounted).
  readonly isFocused: () => boolean
  readonly register: (handle: ComposerHandle | null) => void
}

const ComposerFocusContext = createContext<ComposerFocus | undefined>(undefined)

function useComposerFocus(): ComposerFocus {
  const value = useContext(ComposerFocusContext)
  invariant(value, 'useComposerFocus must be used within a ComposerFocusProvider')
  return value
}

export { ComposerFocusContext, useComposerFocus }
export type { ComposerFocus, ComposerHandle }
