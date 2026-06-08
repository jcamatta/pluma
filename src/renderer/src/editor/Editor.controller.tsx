// Wires the editor hooks (instance + zoom) to the pure EditorView. useManuscriptEditor owns building the
// editor and syncing it with the content prop — the markdown of the selected file (null when none is
// loaded). The editor is null until it finishes initializing on the client, so this renders nothing
// until it is ready. Frontend tools attach here in a later step.

import { useEditorZoom } from './useEditorZoom'
import { useManuscriptEditor } from './useManuscriptEditor'
import { EditorView } from './Editor.view'

type EditorControllerProps = {
  readonly content: string | null
}

export function EditorController({ content }: EditorControllerProps): React.JSX.Element | null {
  const editor = useManuscriptEditor(content)
  const { containerRef, zoom } = useEditorZoom()

  if (!editor) return null

  return <EditorView editor={editor} zoom={zoom} containerRef={containerRef} />
}
