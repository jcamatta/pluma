// Wires the editor hooks (instance + zoom) to the pure EditorView — the editor panel, which composes the
// top bar (file name + settings) and the manuscript surface. useManuscriptEditor owns building the editor
// and syncing it with the content prop — the markdown of the selected file (null when none is loaded).
// useAutoSave persists edits back to the open file (path) with a debounce. The top bar's file name is
// derived from path; opening the settings modal is a later task, so onOpenSettings is a no-op for now. The
// editor is null until it finishes initializing on the client, so this renders nothing until it is ready.
// Frontend tools attach here in a later step.

import { useTranslation } from 'react-i18next'
import { useEditorZoom } from './useEditorZoom'
import { useManuscriptEditor } from './useManuscriptEditor'
import { useAutoSave } from './useAutoSave'
import { EditorView } from './Editor.view'
import { editorFileName } from './editor-file-name-logic'

type EditorControllerProps = {
  readonly path: string | null
  readonly content: string | null
}

export function EditorController({
  path,
  content
}: EditorControllerProps): React.JSX.Element | null {
  const { t } = useTranslation()
  const editor = useManuscriptEditor(content)
  const { containerRef, zoom } = useEditorZoom()
  useAutoSave(editor, path)

  if (!editor) return null

  return (
    <EditorView
      editor={editor}
      zoom={zoom}
      containerRef={containerRef}
      fileName={editorFileName(path, t('editor.untitled'))}
      settingsLabel={t('editor.settings')}
      onOpenSettings={() => {}}
    />
  )
}
