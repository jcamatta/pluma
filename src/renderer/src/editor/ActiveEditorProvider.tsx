// Holds the active editor and the map of open-file editors in state and supplies them through
// ActiveEditorContext. Mounted in the app shell wrapping both the editor column and the rail, so the
// rail can reach the same editors the user edits. The callbacks are stable; the value identity changes
// only when the active editor or the open-editors map changes.

import { useCallback, useMemo, useState, type ReactNode } from 'react'
import type { Editor } from '@tiptap/core'
import { ActiveEditorContext } from './ActiveEditorContext'

interface ActiveEditorProviderProps {
  readonly children: ReactNode
}

function ActiveEditorProvider({ children }: ActiveEditorProviderProps): React.JSX.Element {
  const [editor, setEditor] = useState<Editor | null>(null)
  const [editors, setEditors] = useState<ReadonlyMap<string, Editor>>(new Map())
  const register = useCallback((next: Editor | null) => setEditor(next), [])
  const registerEditor = useCallback((path: string, next: Editor) => {
    setEditors((current) => new Map(current).set(path, next))
  }, [])
  const unregisterEditor = useCallback((path: string) => {
    setEditors((current) => {
      const next = new Map(current)
      next.delete(path)
      return next
    })
  }, [])
  const value = useMemo(
    () => ({ editor, register, editors, registerEditor, unregisterEditor }),
    [editor, register, editors, registerEditor, unregisterEditor]
  )

  return <ActiveEditorContext.Provider value={value}>{children}</ActiveEditorContext.Provider>
}

export { ActiveEditorProvider }
export type { ActiveEditorProviderProps }
