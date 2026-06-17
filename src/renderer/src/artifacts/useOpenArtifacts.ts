// The artifacts panel's live read across every open file: subscribes to all open editors'
// transactions and folds each one's annotation/proposal plugin state into a single path-tagged Artifact
// list plus the set of active composite keys (`path::id`). Reads the open editors from the store via
// useOpenEditors. useSyncExternalStore is the right tool — each editor is an external store, its
// `transaction` event is the change stream, and the snapshot is cached against the per-editor list of
// EditorState identities (a fresh state per transaction) so reads between transactions are referentially
// stable.

import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react'
import type { Editor } from '@tiptap/core'
import type { EditorState } from '@tiptap/pm/state'
import { getActiveAnnotationId, getAnnotations } from '../editor/extensions/annotations'
import { getActiveProposalId, getProposals } from '../editor/extensions/proposals'
import { useOpenEditors } from '../editor/useOpenEditors'
import { toArtifacts } from './to-artifacts'
import { artifactKey } from './artifact-key'
import type { Artifact } from './artifact'

interface OpenArtifacts {
  readonly artifacts: readonly Artifact[]
  readonly activeKeys: ReadonlySet<string>
}

interface Snapshot {
  readonly key: readonly EditorState[]
  readonly value: OpenArtifacts
}

const empty: OpenArtifacts = { artifacts: [], activeKeys: new Set() }

function activeKeysOf(path: string, editor: Editor): readonly string[] {
  return [getActiveAnnotationId(editor), getActiveProposalId(editor)]
    .filter((id): id is string => id !== null)
    .map((id) => artifactKey({ path, id }))
}

function readOpenArtifacts(editors: ReadonlyMap<string, Editor>): OpenArtifacts {
  const entries = [...editors]
  return {
    artifacts: entries.flatMap(([path, editor]) =>
      toArtifacts({ path, annotations: getAnnotations(editor), proposals: getProposals(editor) })
    ),
    activeKeys: new Set(entries.flatMap(([path, editor]) => activeKeysOf(path, editor)))
  }
}

function sameStates(left: readonly EditorState[], right: readonly EditorState[]): boolean {
  return left.length === right.length && left.every((state, index) => state === right[index])
}

function useOpenArtifacts(): OpenArtifacts {
  const entries = useOpenEditors()
  // Project the entry map to an editor-only map; the readers below only need the editor, and keying the
  // memo on the snapshot keeps this map referentially stable until a real open/close/ready transition.
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

  const getSnapshot = useCallback((): OpenArtifacts => {
    const states = [...editors.values()].map((editor) => editor.state)
    if (!sameStates(cache.current.key, states)) {
      cache.current = { key: states, value: readOpenArtifacts(editors) }
    }
    return cache.current.value
  }, [editors])

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export { useOpenArtifacts }
export type { OpenArtifacts }
