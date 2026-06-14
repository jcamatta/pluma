// Wires the editor hooks (instance + zoom) to the pure EditorManuscript surface. Each open file has its
// own editor instance; useEditorFileSync owns that file's content — loading it on mount, reloading it
// when it changes on disk, and persisting edits back (debounced) — so the surface's content and
// artifacts stay coherent across switches. The editor is null until it finishes initializing
// on the client, so this renders nothing until it is ready. It registers the live editor into
// ActiveEditorContext as the active editor only while active (isActive), so the rail's artifacts panel
// reads whichever file the user is editing without several mounted editors clobbering the slot. It also
// adds itself (by path) to the open-editors map so the panel can read every open file's artifacts. The
// panel chrome (the file tabs + settings) is the shared strip above the stack, not part of this surface.
// The editor's frontend tools are contributed once at the shell (EditorToolsBridge), not here.

import { useEffect } from 'react'
import { useEditorZoom } from './useEditorZoom'
import { useManuscriptEditor } from './useManuscriptEditor'
import { useActiveEditor } from './ActiveEditorContext'
import { useEditorFileSync } from './useEditorFileSync'
import { EditorManuscript } from './EditorManuscript'

type EditorControllerProps = {
  readonly path: string | null
  readonly isActive: boolean
}

export function EditorController({
  path,
  isActive
}: EditorControllerProps): React.JSX.Element | null {
  const editor = useManuscriptEditor()
  const { containerRef, zoom } = useEditorZoom()
  const { register, registerEditor, unregisterEditor } = useActiveEditor()
  useEditorFileSync(editor, path)

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

  return <EditorManuscript editor={editor} zoom={zoom} containerRef={containerRef} />
}
