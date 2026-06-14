// Owns the manuscript editor instance: builds it with our extensions. Returns the TipTap editor, which
// is null until it finishes initializing on the client (useEditor defaults to immediatelyRender:
// false), so the controller renders nothing until it is ready. Content sync (load, reload, autosave) is
// the coordinator's job (useEditorFileSync); this hook only constructs the instance.

import { useEditor } from '@tiptap/react'
import type { Editor } from '@tiptap/react'
import { editorExtensions } from './extensions'

function useManuscriptEditor(): Editor | null {
  return useEditor({
    content: '',
    contentType: 'markdown',
    extensions: editorExtensions,
    editorProps: {
      attributes: {
        class: 'min-h-full min-w-0 flex-1 font-editor outline-none'
      }
    }
  })
}

export { useManuscriptEditor }
