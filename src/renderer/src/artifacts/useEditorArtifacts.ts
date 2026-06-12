// The artifacts panel's live read of the editor: subscribes to the active editor's transactions and
// folds its annotation/proposal plugin state into the ordered Artifact list plus the set of active ids
// (at most one annotation + one proposal are active at a time). Reads the editor from ActiveEditorContext
// and returns the empty result when no document is open.
//
// useSyncExternalStore is the right tool: the editor is an external store, `editor.on('transaction', …)`
// is its change stream, and the snapshot is cached against the current ProseMirror EditorState identity
// (a fresh state per transaction) so repeated reads between transactions are referentially stable.

import { useCallback, useRef, useSyncExternalStore } from 'react'
import type { Editor } from '@tiptap/core'
import type { EditorState } from '@tiptap/pm/state'
import { getActiveAnnotationId, getAnnotations } from '../editor/extensions/annotations'
import { getActiveProposalId, getProposals } from '../editor/extensions/proposals'
import { useActiveEditor } from '../editor/ActiveEditorContext'
import { toArtifacts } from './to-artifacts'
import type { Artifact } from './artifact'

interface EditorArtifacts {
  readonly artifacts: readonly Artifact[]
  readonly activeIds: ReadonlySet<string>
}

interface Snapshot {
  readonly key: EditorState | null
  readonly value: EditorArtifacts
}

function readEditorArtifacts(editor: Editor): EditorArtifacts {
  const activeIds = [getActiveAnnotationId(editor), getActiveProposalId(editor)].filter(
    (id): id is string => id !== null
  )
  return {
    artifacts: toArtifacts(getAnnotations(editor), getProposals(editor)),
    activeIds: new Set(activeIds)
  }
}

function useEditorArtifacts(): EditorArtifacts {
  const { editor } = useActiveEditor()
  const cache = useRef<Snapshot>({ key: null, value: { artifacts: [], activeIds: new Set() } })

  const subscribe = useCallback(
    (onStoreChange: () => void): (() => void) => {
      if (!editor) return () => undefined
      editor.on('transaction', onStoreChange)
      return () => {
        editor.off('transaction', onStoreChange)
      }
    },
    [editor]
  )

  const getSnapshot = useCallback((): EditorArtifacts => {
    if (!editor) {
      if (cache.current.key !== null) {
        cache.current = { key: null, value: { artifacts: [], activeIds: new Set() } }
      }
      return cache.current.value
    }
    if (cache.current.key !== editor.state) {
      cache.current = { key: editor.state, value: readEditorArtifacts(editor) }
    }
    return cache.current.value
  }, [editor])

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export { useEditorArtifacts }
export type { EditorArtifacts }
