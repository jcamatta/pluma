// Syncs externally-loaded markdown into the editor. When the content prop changes (e.g. the user
// selects a different file in the explorer), it replaces the editor's content via setContent with the
// markdown contentType. Null means no file is loaded yet, so the editor is left untouched.

import { useEffect } from 'react'
import type { Editor } from '@tiptap/react'

function useEditorContent(editor: Editor | null, content: string | null): void {
  useEffect(() => {
    if (editor === null || content === null) return
    editor.commands.setContent(content, { contentType: 'markdown' })
  }, [editor, content])
}

export { useEditorContent }
