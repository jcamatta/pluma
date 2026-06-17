// Contributes the editor's frontend tools to the agent registry. Mounted once in the shell rather than
// per file, so several open editors never fight over the same tool names. It hands the tools a sync
// resolver (for the active selection) plus an async ensure (open-on-demand) over the open-editor store,
// the file reader, and the background-open command — so any file, open or not, can be addressed by path.
// Renders nothing; it exists only to own the registration.

import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Editor } from '@tiptap/core'
import { useRepos } from '../explorer/RepositoriesContext'
import { fileContentKey } from '../explorer/file-query-keys'
import { useActiveEditor } from './ActiveEditorContext'
import { useOpenFiles } from './OpenFilesContext'
import type { EnsureOutcome } from './editor-resolver.port'
import { useEditorTools } from './useEditorTools'

function EditorToolsBridge(): null {
  const { store } = useActiveEditor()
  const { activePath, openInBackground } = useOpenFiles()
  const { fileReader } = useRepos()
  const queryClient = useQueryClient()
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

  // Make the file at `path` available to act on. We pre-flight-READ the file before opening anything, so
  // a stale/nonexistent path fails cleanly and leaves NO phantom tab; only a successful read opens the
  // background tab. The await is settled deterministically by the store's 'ready'/'removed' events — no
  // timer (a hang would be a bug to fix, not a timeout to mask). A successfully pre-read file always
  // reaches 'ready' (the seeded cache makes useFileContent return ok on first render), so the only
  // 'removed' outcome is the user closing the just-opened tab mid-load.
  const ensure = useCallback(
    async (path: string): Promise<EnsureOutcome> => {
      const open = store.getSnapshot().get(path)
      if (open?.status === 'ready') return { status: 'ready', editor: open.editor }

      const read = await fileReader.read(path)
      if (!read.ok) return { status: 'failed', message: `${path} does not exist or cannot be read` }

      // Prime the content cache with the read Result so useEditorFileSync loads from cache (no second
      // disk read), then open the tab without stealing focus and wait until its editor has loaded.
      queryClient.setQueryData(fileContentKey(path), read)
      openInBackground(path)
      const editor = await store.waitUntilReady(path)
      return editor === null
        ? { status: 'failed', message: 'the file was closed before it could open — try again' }
        : { status: 'ready', editor }
    },
    [store, fileReader, queryClient, openInBackground]
  )

  useEditorTools({ resolve, ensure, activePath, openPaths })
  return null
}

export { EditorToolsBridge }
