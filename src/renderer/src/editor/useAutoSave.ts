// Persists editor changes back to the open file with a trailing debounce. While a file is open, each
// editor 'update' schedules a debounced write of the current markdown; on unmount or when the open file
// changes, it flushes the latest markdown immediately so no edit is lost in the debounce window. The
// path is captured per-effect, so the flush on a file switch writes the file that was open during those
// edits — not the one being switched to. No file open means no listener and no writes.

import { useEffect } from 'react'
import type { Editor } from '@tiptap/react'
import { useDebouncedCallback } from '../lib/useDebouncedCallback'
import { useFileWrite } from '../explorer/useFileWrite'

const SAVE_DELAY_MS = 1000

function useAutoSave(editor: Editor | null, path: string | null): void {
  const write = useFileWrite()
  const debouncedWrite = useDebouncedCallback(write, SAVE_DELAY_MS)

  useEffect(() => {
    if (editor === null || path === null) return

    const onUpdate = (): void => {
      void debouncedWrite(path, editor.getMarkdown())
    }

    editor.on('update', onUpdate)
    return () => {
      editor.off('update', onUpdate)
      void write(path, editor.getMarkdown())
    }
  }, [editor, path, write, debouncedWrite])
}

export { useAutoSave }
