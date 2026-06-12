// Holds the currently-mounted editor in state and supplies it through ActiveEditorContext. Mounted in
// the app shell wrapping both the editor column and the rail, so the rail can reach the same editor the
// user edits. `register` is stable; the value identity changes only when the editor instance changes.

import { useCallback, useMemo, useState, type ReactNode } from 'react'
import type { Editor } from '@tiptap/core'
import { ActiveEditorContext } from './ActiveEditorContext'

interface ActiveEditorProviderProps {
  readonly children: ReactNode
}

function ActiveEditorProvider({ children }: ActiveEditorProviderProps): React.JSX.Element {
  const [editor, setEditor] = useState<Editor | null>(null)
  const register = useCallback((next: Editor | null) => setEditor(next), [])
  const value = useMemo(() => ({ editor, register }), [editor, register])

  return <ActiveEditorContext.Provider value={value}>{children}</ActiveEditorContext.Provider>
}

export { ActiveEditorProvider }
export type { ActiveEditorProviderProps }
