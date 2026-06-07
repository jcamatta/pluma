// Wires the editor hooks (instance + zoom) to the pure EditorView. Renders nothing until the editor
// view is ready. Frontend tools attach here in a later step; for now it only owns layout state.

import { useEditorZoom } from './useEditorZoom'
import { EditorView } from './Editor.view'
import { useEditor } from '@tiptap/react'
import { editorExtensions } from './extensions'

export function EditorController(): React.JSX.Element | null {
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
  const { containerRef, zoom } = useEditorZoom()

  if (!editor) return null

  return <EditorView editor={editor} zoom={zoom} containerRef={containerRef} />
}
