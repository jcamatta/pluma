// A single editor's live suggestion list: subscribes to that editor's transactions and folds its
// annotation/proposal plugin state into the merged, position-ordered list (plus pending count) the
// sub-topbar and list popover read. useSyncExternalStore is the right tool — the editor is an external
// store, its `transaction` event is the change stream, and the snapshot is cached against the EditorState
// identity (a fresh state per transaction) so reads between transactions are referentially stable. Mirrors
// AnnotationCard.controller's single-editor subscription; artifacts/useOpenArtifacts.ts is the all-editors
// variant, left untouched and removed with artifacts/ in PR 2.

import { useCallback, useRef, useSyncExternalStore } from 'react'
import type { Editor } from '@tiptap/core'
import type { EditorState } from '@tiptap/pm/state'
import { getAnnotations } from './extensions/annotations'
import { getProposals } from './extensions/proposals'
import { toSuggestionList, type SuggestionList } from './suggestion-list'

interface Snapshot {
  readonly state: EditorState | null
  readonly value: SuggestionList
}

const empty: SuggestionList = { items: [], pendingCount: 0 }

function readSuggestions(editor: Editor): SuggestionList {
  return toSuggestionList({
    annotations: getAnnotations(editor),
    proposals: getProposals(editor)
  })
}

function useEditorSuggestions(editor: Editor): SuggestionList {
  const cache = useRef<Snapshot>({ state: null, value: empty })

  const subscribe = useCallback(
    (onStoreChange: () => void): (() => void) => {
      editor.on('transaction', onStoreChange)
      return () => editor.off('transaction', onStoreChange)
    },
    [editor]
  )

  const getSnapshot = useCallback((): SuggestionList => {
    if (cache.current.state !== editor.state) {
      cache.current = { state: editor.state, value: readSuggestions(editor) }
    }
    return cache.current.value
  }, [editor])

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export { useEditorSuggestions }
