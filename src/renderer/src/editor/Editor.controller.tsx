// Wires the editor hooks (instance + zoom) to the pure EditorView — the editor panel, which composes the
// top bar (file name + settings) and the manuscript surface. useManuscriptEditor owns building the editor
// and syncing it with the content prop — the markdown of the selected file (null when none is loaded).
// useAutoSave persists edits back to the open file (path) with a debounce. The top bar's file name is
// derived from path; onOpenSettings comes from the app shell, which owns the settings modal's open state.
// The editor is null until it finishes initializing on the client, so this renders nothing until it is
// ready. useEditorTools contributes the editor's frontend tools to the agent registry for as long as
// the editor column is mounted. It also registers the live editor into ActiveEditorContext so sibling
// columns (the rail's artifacts panel) can read its annotations/proposals and drive its commands.

import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useEditorZoom } from './useEditorZoom'
import { useManuscriptEditor } from './useManuscriptEditor'
import { useEditorTools } from './useEditorTools'
import { useActiveEditor } from './ActiveEditorContext'
import { useAutoSave } from './useAutoSave'
import { EditorView } from './Editor.view'
import { editorFileName } from './editor-file-name-logic'

type EditorControllerProps = {
  readonly path: string | null
  readonly content: string | null
  readonly onOpenSettings: () => void
}

export function EditorController({
  path,
  content,
  onOpenSettings
}: EditorControllerProps): React.JSX.Element | null {
  const { t } = useTranslation()
  const editor = useManuscriptEditor(content)
  const { containerRef, zoom } = useEditorZoom()
  const { register } = useActiveEditor()
  useEditorTools(editor)
  useAutoSave(editor, path)

  useEffect(() => {
    register(editor)
    return () => register(null)
  }, [editor, register])

  if (!editor) return null

  return (
    <EditorView
      editor={editor}
      zoom={zoom}
      containerRef={containerRef}
      fileName={editorFileName(path, t('editor.untitled'))}
      settingsLabel={t('editor.settings')}
      onOpenSettings={onOpenSettings}
    />
  )
}
