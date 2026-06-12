// Contributes the editor's frontend tools to the agent registry, bound to whichever editor is
// active. Mounted once in the shell rather than per file, so several open editors never fight over
// the same tool names — switching files rebinds the handlers to the new active editor through the
// ActiveEditorContext. Renders nothing; it exists only to own the registration.

import { useActiveEditor } from './ActiveEditorContext'
import { useEditorTools } from './useEditorTools'

function EditorToolsBridge(): null {
  const { editor } = useActiveEditor()
  useEditorTools(editor)
  return null
}

export { EditorToolsBridge }
