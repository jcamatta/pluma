// Contributes the editor's frontend tools to the agent registry. Mounted once in the shell rather than
// per file, so several open editors never fight over the same tool names. It hands the tools a resolver
// over the open-editor store plus the active file's path: today every tool acts on the editor open
// at the active path, and (once the tools take a path) any open file can be addressed by it. Renders
// nothing; it exists only to own the registration.

import { useCallback } from 'react'
import type { Editor } from '@tiptap/core'
import { useActiveEditor } from './ActiveEditorContext'
import { useOpenFiles } from './OpenFilesContext'
import { useEditorTools } from './useEditorTools'

function EditorToolsBridge(): null {
  const { store } = useActiveEditor()
  const { activePath } = useOpenFiles()
  // Resolve and the open-set both read store.getSnapshot() at CALL time, never a captured/subscribed
  // snapshot: during an agent turn a file can open mid-turn (a later step opens a background tab) and the
  // tool handler runs synchronously before React re-renders. Reading the store at invocation is always
  // fresh — a captured snapshot would hand the agent a stale open-set or fail to resolve the just-opened
  // editor.
  const resolve = useCallback(
    (path: string): Editor | null => store.getSnapshot().get(path)?.editor ?? null,
    [store]
  )
  const openPaths = useCallback((): readonly string[] => [...store.getSnapshot().keys()], [store])
  useEditorTools({ resolve, activePath, openPaths })
  return null
}

export { EditorToolsBridge }
