// The reactive read of the open editors: subscribes to the OpenEditorsStore and returns its live entry
// snapshot. This is the single subscription seam — every shell reader (artifacts panel, pending counts)
// folds the entries it needs from here, instead of the provider deriving a second projection. Because the
// store's snapshot has stable identity until a mutation, useSyncExternalStore re-renders only on a real
// open/close/ready transition.

import { useSyncExternalStore } from 'react'
import { useActiveEditor } from './ActiveEditorContext'
import type { OpenEditorEntry } from './open-editors-store'

function useOpenEditors(): ReadonlyMap<string, OpenEditorEntry> {
  const { store } = useActiveEditor()
  return useSyncExternalStore(store.on, store.getSnapshot)
}

export { useOpenEditors }
