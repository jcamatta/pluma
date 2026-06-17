// Holds the active editor and owns the one OpenEditorsStore, supplying both through ActiveEditorContext.
// Mounted in the app shell wrapping both the editor column and the rail, so the rail can reach the same
// editors the user edits. The store is created once for the provider's lifetime; `editors` is derived
// from its live snapshot so existing readers see the open editor per path. The value identity changes
// only when the active editor or the store snapshot changes.

import { useCallback, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
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
  const snapshot = useSyncExternalStore(store.on, store.getSnapshot)
  const editors = useMemo<ReadonlyMap<string, Editor>>(
    () => new Map([...snapshot].map(([path, entry]) => [path, entry.editor])),
    [snapshot]
  )
  const value = useMemo(
    () => ({ editor, register, store, editors }),
    [editor, register, store, editors]
  )

  return <ActiveEditorContext.Provider value={value}>{children}</ActiveEditorContext.Provider>
}

export { ActiveEditorProvider }
export type { ActiveEditorProviderProps }
