// Holds the active editor and owns the one OpenEditorsStore, supplying both through ActiveEditorContext.
// Mounted in the app shell wrapping both the editor column and the rail, so the rail can reach the same
// editors the user edits. The store is created once for the provider's lifetime; readers subscribe to its
// live snapshot via useOpenEditors, so opening or closing a file no longer re-renders the whole subtree —
// only the value identity (active editor / store) gates this provider's re-render.

import { useCallback, useMemo, useState, type ReactNode } from 'react'
import type { Editor } from '@tiptap/core'
import { ActiveEditorContext } from './ActiveEditorContext'
import { createOpenEditorsStore } from './open-editors-store'

interface ActiveEditorProviderProps {
  readonly children: ReactNode
}

function ActiveEditorProvider({ children }: ActiveEditorProviderProps): React.JSX.Element {
  const [editor, setEditor] = useState<Editor | null>(null)
  const register = useCallback((next: Editor | null) => setEditor(next), [])
  // Lazy initializer so the store is created exactly once and never recreated on re-render.
  const [store] = useState(createOpenEditorsStore)
  const value = useMemo(() => ({ editor, register, store }), [editor, register, store])

  return <ActiveEditorContext.Provider value={value}>{children}</ActiveEditorContext.Provider>
}

export { ActiveEditorProvider }
export type { ActiveEditorProviderProps }
