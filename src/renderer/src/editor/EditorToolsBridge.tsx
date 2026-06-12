// Contributes the editor's frontend tools to the agent registry. Mounted once in the shell rather than
// per file, so several open editors never fight over the same tool names. It hands the tools a resolver
// over the open-editor registry plus the active file's path: today every tool acts on the editor open
// at the active path, and (once the tools take a path) any open file can be addressed by it. Renders
// nothing; it exists only to own the registration.

import { useCallback } from 'react'
import type { Editor } from '@tiptap/core'
import { useActiveEditor } from './ActiveEditorContext'
import { useOpenFiles } from './OpenFilesContext'
import { useEditorTools } from './useEditorTools'

function EditorToolsBridge(): null {
  const { editors } = useActiveEditor()
  const { activePath } = useOpenFiles()
  const resolve = useCallback(
    (path: string): Editor | null => editors.get(path) ?? null,
    [editors]
  )
  useEditorTools({ resolve, activePath })
  return null
}

export { EditorToolsBridge }
