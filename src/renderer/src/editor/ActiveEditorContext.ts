// Context carrying the currently-mounted manuscript editor so sibling columns (notably the rail) can
// read its artifact state and drive its commands. The editor lives inside EditorController; it registers
// itself here when ready and clears on unmount. Consumers read `editor` (null until a document is open);
// EditorController calls `register`. The single seam between the editor column and the rest of the shell.

import { createContext, useContext } from 'react'
import type { Editor } from '@tiptap/core'
import { invariant } from '../../../shared/invariant'

interface ActiveEditor {
  readonly editor: Editor | null
  readonly register: (editor: Editor | null) => void
}

const ActiveEditorContext = createContext<ActiveEditor | undefined>(undefined)

function useActiveEditor(): ActiveEditor {
  const value = useContext(ActiveEditorContext)
  invariant(value, 'useActiveEditor must be used within an ActiveEditorProvider')
  return value
}

export { ActiveEditorContext, useActiveEditor }
export type { ActiveEditor }
