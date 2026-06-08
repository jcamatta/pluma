// Owns the manuscript editor instance: builds it with our extensions and keeps it in sync with the
// markdown content prop. Returns the TipTap editor, which is null until it finishes initializing on the
// client (useEditor defaults to immediatelyRender: false), so the controller renders nothing until it is
// ready. This keeps the editor-construction details out of the controller.

import { useEditor } from '@tiptap/react'
import type { Editor } from '@tiptap/react'
import { editorExtensions } from './extensions'
import { useEditorContent } from './useEditorContent'

function useManuscriptEditor(content: string | null): Editor | null {
  const editor = useEditor({
    content: '',
    contentType: 'markdown',
    extensions: editorExtensions,
    editorProps: {
      attributes: {
        class: 'min-h-full min-w-0 flex-1 font-editor outline-none'
      }
    }
  })
  useEditorContent(editor, content)
  return editor
}

export { useManuscriptEditor }
