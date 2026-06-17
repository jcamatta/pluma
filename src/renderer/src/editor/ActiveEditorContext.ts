// Context carrying the editor state sibling columns (notably the rail) read and drive. Two concerns:
// `editor` is the currently-active editor (focus) — what the agent tools and same-file panel commands
// act on; the active EditorController sets it via `register`. `store` is the single source of truth for
// the open editors — each file's EditorController mounts/marks-ready/removes itself there as it loads
// and unmounts, and readers subscribe to it via useOpenEditors. The single seam between the editor
// column and the rest of the shell.

import { createContext, useContext } from 'react'
import type { Editor } from '@tiptap/core'
import { invariant } from '../../../shared/invariant'
import type { OpenEditorsStore } from './open-editors-store'

interface ActiveEditor {
  readonly editor: Editor | null
  readonly register: (editor: Editor | null) => void
  readonly store: OpenEditorsStore
}

const ActiveEditorContext = createContext<ActiveEditor | undefined>(undefined)

function useActiveEditor(): ActiveEditor {
  const value = useContext(ActiveEditorContext)
  invariant(value, 'useActiveEditor must be used within an ActiveEditorProvider')
  return value
}

export { ActiveEditorContext, useActiveEditor }
export type { ActiveEditor }
