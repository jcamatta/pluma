// Wires the editor hooks (instance + zoom) to the pure EditorManuscript surface. Each open file has its
// own editor instance; useEditorFileSync owns that file's content — loading it on mount, reloading it
// when it changes on disk, and persisting edits back (debounced) — so the surface's content and
// artifacts stay coherent across switches. The editor is null until it finishes initializing
// on the client, so this renders nothing until it is ready. It registers the live editor into
// ActiveEditorContext as the active editor only while active (isActive), so the rail's artifacts panel
// reads whichever file the user is editing without several mounted editors clobbering the slot. It also
// drives the open-editors store (mount on init, mark ready once its content loads, remove on unmount) so
// the panel can read every open file's artifacts. The
// panel chrome (the file tabs + settings) is the shared strip above the stack, not part of this surface.
// The editor's frontend tools are contributed once at the shell (EditorToolsBridge), not here. Each editor
// owns its own header row 2 — the suggestions sub-topbar — above its manuscript, so only the active editor's
// (and thus its bar) is visible; the bar renders only when the file has suggestions.

import { useEffect } from 'react'
import { useEditorZoom } from './useEditorZoom'
import { useManuscriptEditor } from './useManuscriptEditor'
import { useActiveEditor } from './ActiveEditorContext'
import { useEditorFileSync } from './useEditorFileSync'
import { EditorManuscript } from './EditorManuscript'
import { EditorSurface } from './EditorSurface.view'
import { SuggestionsBarController } from './SuggestionsBar.controller'

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
  const { register, store } = useActiveEditor()
  const { loaded } = useEditorFileSync(editor, path)

  useEffect(() => {
    if (!editor || !isActive) return
    register(editor)
    return () => register(null)
  }, [editor, isActive, register])

  useEffect(() => {
    if (!editor || path === null) return
    store.mount(path, editor)
    return () => store.remove(path)
  }, [editor, path, store])

  useEffect(() => {
    if (!editor || path === null || !loaded) return
    // No-op if the entry is absent, so this can't outrace the mount effect above.
    store.markReady(path)
  }, [editor, path, loaded, store])

  if (!editor) return null

  return (
    <EditorSurface
      bar={<SuggestionsBarController editor={editor} />}
      body={<EditorManuscript editor={editor} zoom={zoom} containerRef={containerRef} />}
    />
  )
}
