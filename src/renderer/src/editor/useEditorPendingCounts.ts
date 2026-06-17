// The tab strip's live per-file pending-suggestion counts: subscribes to every open editor's
// transactions and runs the pure suggestion-list over each one, keyed by path. useSyncExternalStore over
// the editors map — each editor is an external store, its `transaction` event is the change stream, and
// the snapshot is cached against the per-editor list of EditorState identities so reads between
// transactions are referentially stable. Mirrors artifacts/useOpenArtifacts.ts (left untouched, removed
// with artifacts/ in PR 2); one pure suggestion-list module, two callers (this and useEditorSuggestions).

import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react'
import type { Editor } from '@tiptap/core'
import type { EditorState } from '@tiptap/pm/state'
import { getAnnotations } from './extensions/annotations'
import { getProposals } from './extensions/proposals'
import { useOpenEditors } from './useOpenEditors'
import { toSuggestionList } from './suggestion-list'

type PendingCounts = ReadonlyMap<string, number>

interface Snapshot {
  readonly key: readonly EditorState[]
  readonly value: PendingCounts
}

const empty: PendingCounts = new Map()

function readPendingCounts(editors: ReadonlyMap<string, Editor>): PendingCounts {
  return new Map(
    [...editors].map(([path, editor]) => [
      path,
      toSuggestionList({ annotations: getAnnotations(editor), proposals: getProposals(editor) })
        .pendingCount
    ])
  )
}

function sameStates(left: readonly EditorState[], right: readonly EditorState[]): boolean {
  return left.length === right.length && left.every((state, index) => state === right[index])
}

function sameCounts(left: PendingCounts, right: PendingCounts): boolean {
  return left.size === right.size && [...right].every(([path, count]) => left.get(path) === count)
}

function useEditorPendingCounts(): PendingCounts {
  const entries = useOpenEditors()
  // Project the entry map to an editor-only map; the suggestion-list read only needs the editor, and
  // keying the memo on the snapshot keeps this map referentially stable until a real transition.
  const editors = useMemo<ReadonlyMap<string, Editor>>(
    () => new Map([...entries].map(([path, entry]) => [path, entry.editor])),
    [entries]
  )
  const cache = useRef<Snapshot>({ key: [], value: empty })

  const subscribe = useCallback(
    (onStoreChange: () => void): (() => void) => {
      const detach = [...editors.values()].map((editor) => {
        editor.on('transaction', onStoreChange)
        return () => editor.off('transaction', onStoreChange)
      })
      return () => detach.forEach((off) => off())
    },
    [editors]
  )

  const getSnapshot = useCallback((): PendingCounts => {
    const states = [...editors.values()].map((editor) => editor.state)
    if (!sameStates(cache.current.key, states)) {
      const next = readPendingCounts(editors)
      // Keep the previous value's identity when the counts are unchanged so useSyncExternalStore does
      // not re-render the tab strip on every keystroke — most transactions leave the counts untouched.
      const value = sameCounts(cache.current.value, next) ? cache.current.value : next
      cache.current = { key: states, value }
    }
    return cache.current.value
  }, [editors])

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export { useEditorPendingCounts }
export type { PendingCounts }
