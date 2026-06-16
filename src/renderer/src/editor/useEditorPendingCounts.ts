// The tab strip's live per-file pending-suggestion counts: subscribes to every registered editor's
// transactions and runs the pure suggestion-list over each one, keyed by path. useSyncExternalStore over
// the editors map — each editor is an external store, its `transaction` event is the change stream, and
// the snapshot is cached against the per-editor list of EditorState identities so reads between
// transactions are referentially stable. Mirrors artifacts/useOpenArtifacts.ts (left untouched, removed
// with artifacts/ in PR 2); one pure suggestion-list module, two callers (this and useEditorSuggestions).

import { useCallback, useRef, useSyncExternalStore } from 'react'
import type { Editor } from '@tiptap/core'
import type { EditorState } from '@tiptap/pm/state'
import { getAnnotations } from './extensions/annotations'
import { getProposals } from './extensions/proposals'
import { useActiveEditor } from './ActiveEditorContext'
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

function useEditorPendingCounts(): PendingCounts {
  const { editors } = useActiveEditor()
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
      cache.current = { key: states, value: readPendingCounts(editors) }
    }
    return cache.current.value
  }, [editors])

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export { useEditorPendingCounts }
export type { PendingCounts }
