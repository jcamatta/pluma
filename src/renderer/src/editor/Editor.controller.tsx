// Wires the editor hooks (instance + zoom) to the pure EditorView — the editor panel, which composes the
// top bar (file name + settings) and the manuscript surface. The controller loads this file's markdown
// itself (useFileContent by path) and hands it to useManuscriptEditor; each open file has its own
// editor instance, so its content is set once on load and never swapped underneath a live document —
// that is what keeps a file's artifacts intact across switches. useAutoSave persists edits back to the
// open file (path) with a debounce. The top bar's file name is derived from path; onOpenSettings comes
// from the app shell, which owns the settings modal's open state. The editor is null until it finishes
// initializing on the client, so this renders nothing until it is ready. It registers the live editor
// into ActiveEditorContext as the active editor only while active (isActive), so the rail's artifacts
// panel reads whichever file the user is editing without several mounted editors clobbering the slot.
// It also adds itself (by path) to the open-editors map so the panel can read every open file's
// artifacts. The editor's frontend tools are contributed once at the shell (EditorToolsBridge), not here.

import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useEditorZoom } from './useEditorZoom'
import { useManuscriptEditor } from './useManuscriptEditor'
import { useActiveEditor } from './ActiveEditorContext'
import { useAutoSave } from './useAutoSave'
import { useFileContent } from '../explorer/useFileContent'
import { EditorView } from './Editor.view'
import { editorFileName } from './editor-file-name-logic'

type EditorControllerProps = {
  readonly path: string | null
  readonly isActive: boolean
  readonly onOpenSettings: () => void
}

export function EditorController({
  path,
  isActive,
  onOpenSettings
}: EditorControllerProps): React.JSX.Element | null {
  const { t } = useTranslation()
  const fileContent = useFileContent(path)
  const content = fileContent && fileContent.ok ? fileContent.value : null
  const editor = useManuscriptEditor(content)
  const { containerRef, zoom } = useEditorZoom()
  const { register, registerEditor, unregisterEditor } = useActiveEditor()
  useAutoSave(editor, path)

  useEffect(() => {
    if (!editor || !isActive) return
    register(editor)
    return () => register(null)
  }, [editor, isActive, register])

  useEffect(() => {
    if (!editor || path === null) return
    registerEditor(path, editor)
    return () => unregisterEditor(path)
  }, [editor, path, registerEditor, unregisterEditor])

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
