// Context carrying the editor state sibling columns (notably the rail) read and drive. Two concerns:
// `editor` is the currently-active editor (focus) — what the agent tools and same-file panel commands
// act on; the active EditorController sets it via `register`. `editors` is the map of every open file's
// editor keyed by path — what the artifacts panel reads across files so a card can show its file and
// reveal in it; each file's EditorController adds itself via `registerEditor` and removes itself on
// unmount. The single seam between the editor column and the rest of the shell.

import { createContext, useContext } from 'react'
import type { Editor } from '@tiptap/core'
import { invariant } from '../../../shared/invariant'

interface ActiveEditor {
  readonly editor: Editor | null
  readonly register: (editor: Editor | null) => void
  readonly editors: ReadonlyMap<string, Editor>
  readonly registerEditor: (path: string, editor: Editor) => void
  readonly unregisterEditor: (path: string) => void
}

const ActiveEditorContext = createContext<ActiveEditor | undefined>(undefined)

function useActiveEditor(): ActiveEditor {
  const value = useContext(ActiveEditorContext)
  invariant(value, 'useActiveEditor must be used within an ActiveEditorProvider')
  return value
}

export { ActiveEditorContext, useActiveEditor }
export type { ActiveEditor }
