// The single owner of an open file's content. It reads the file (useFileContent query), applies disk
// into the editor, persists edits back (debounced useFileWrite command), and re-reads when the OS
// reports the file changed — coordinating all of it through one baseline (the content we last synced
// with disk). disk-wins: an external change reloads the editor; the baseline advancing on our own
// successful writes is what stops a debounced self-write, read back through the watcher, from looking
// like an external change and reverting newer keystrokes. Returns void, like the autosave it replaces;
// path is stable per editor instance (each open file is a key-ed controller), so the baseline starts
// null and never needs resetting.

import { useCallback, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Editor } from '@tiptap/react'
import { useDebouncedCallback } from '../lib/useDebouncedCallback'
import { useFileContent } from '../explorer/useFileContent'
import { useFileWrite } from '../explorer/useFileWrite'
import { fileContentKey } from '../explorer/file-query-keys'
import { useRepos } from '../explorer/RepositoriesContext'
import { reconcileFileContent } from './reconcile-file-content'

const SAVE_DELAY_MS = 1000

function useEditorFileSync(editor: Editor | null, path: string | null): void {
  const fileContent = useFileContent(path)
  const disk = fileContent && fileContent.ok ? fileContent.value : null
  const baseRef = useRef<string | null>(null)
  const write = useFileWrite()
  const { writer } = useRepos()
  const queryClient = useQueryClient()

  const persist = useCallback(
    (target: string, content: string) =>
      write(target, content).then((result) => {
        if (result.ok) baseRef.current = content
        return result
      }),
    [write]
  )
  const debouncedWrite = useDebouncedCallback(persist, SAVE_DELAY_MS)

  useEffect(() => {
    if (editor === null || disk === null) return
    if (reconcileFileContent(disk, baseRef.current) === 'skip') return
    baseRef.current = disk
    if (editor.getMarkdown() !== disk) {
      editor.commands.setContent(disk, { contentType: 'markdown' })
    }
  }, [editor, disk])

  useEffect(() => {
    if (editor === null || path === null) return
    const onUpdate = (): void => {
      void debouncedWrite(path, editor.getMarkdown())
    }
    editor.on('update', onUpdate)
    return () => {
      editor.off('update', onUpdate)
      void persist(path, editor.getMarkdown())
    }
  }, [editor, path, persist, debouncedWrite])

  useEffect(() => {
    if (path === null) return
    return writer.onChange((change) => {
      if (change.path === path && change.type === 'updated') {
        void queryClient.invalidateQueries({ queryKey: fileContentKey(path) })
      }
    })
  }, [path, writer, queryClient])
}

export { useEditorFileSync }
