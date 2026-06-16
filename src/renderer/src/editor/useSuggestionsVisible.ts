// Mirrors a single editor's suggestions-ui `visible` flag (held in ProseMirror plugin state) into React so
// the sub-topbar's Hide all / Show all toggle re-renders when it flips. The flag stays the source of truth
// in plugin state — this only subscribes to the editor's transactions and reads it back, the same
// useSyncExternalStore pattern as useEditorSuggestions / AnnotationCard.controller.

import { useCallback, useSyncExternalStore } from 'react'
import type { Editor } from '@tiptap/core'
import { getSuggestionsVisible } from './extensions/suggestions-ui'

function useSuggestionsVisible(editor: Editor): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void): (() => void) => {
      editor.on('transaction', onStoreChange)
      return () => editor.off('transaction', onStoreChange)
    },
    [editor]
  )

  const getSnapshot = useCallback((): boolean => getSuggestionsVisible(editor), [editor])

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export { useSuggestionsVisible }
