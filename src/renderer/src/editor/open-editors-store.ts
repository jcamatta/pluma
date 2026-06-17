// The single source of truth for the open editors: an event-driven store whose entries carry their
// lifecycle status. React reactivity (useSyncExternalStore) and the "wait until ready" await both hang
// off the SAME event stream, so there is one emitter — never a state plus a separate notifier. Each
// mutator updates the map and emits its event in the same call, so the map and the stream cannot drift.
// Plain TS, no React: directly unit-testable.

import type { Editor } from '@tiptap/core'

type OpenEditorEntry = { readonly editor: Editor; readonly status: 'loading' | 'ready' }

type OpenEditorEvent =
  | { readonly type: 'mounted'; readonly path: string; readonly editor: Editor }
  | { readonly type: 'ready'; readonly path: string; readonly editor: Editor }
  | { readonly type: 'removed'; readonly path: string }

interface OpenEditorsStore {
  getSnapshot(): ReadonlyMap<string, OpenEditorEntry>
  on(listener: (event: OpenEditorEvent) => void): () => void
  mount(path: string, editor: Editor): void
  markReady(path: string): void
  remove(path: string): void
  waitUntilReady(path: string): Promise<Editor | null>
}

function createOpenEditorsStore(): OpenEditorsStore {
  // A single instance-local state object (mutated wholesale, never module-level) holding the current
  // snapshot and the subscribers — the same pattern as the slash-menu bridge. The snapshot is a frozen
  // map with stable identity: the same reference until a mutation, a NEW reference after each one, which
  // is what useSyncExternalStore needs to detect changes by identity.
  const state = {
    snapshot: Object.freeze(new Map<string, OpenEditorEntry>()),
    listeners: new Set<(event: OpenEditorEvent) => void>()
  }

  // The one place the map changes: clone, apply, freeze, swap, then emit — so readers and subscribers
  // observe the change together.
  function commit(next: Map<string, OpenEditorEntry>, event: OpenEditorEvent): void {
    state.snapshot = Object.freeze(next)
    state.listeners.forEach((listener) => listener(event))
  }

  function getSnapshot(): ReadonlyMap<string, OpenEditorEntry> {
    return state.snapshot
  }

  function on(listener: (event: OpenEditorEvent) => void): () => void {
    state.listeners.add(listener)
    return () => {
      state.listeners.delete(listener)
    }
  }

  function mount(path: string, editor: Editor): void {
    const next = new Map(state.snapshot)
    next.set(path, { editor, status: 'loading' })
    commit(next, { type: 'mounted', path, editor })
  }

  function markReady(path: string): void {
    const entry = state.snapshot.get(path)
    // No-op when the path is absent: nothing to flip, so emit nothing.
    if (entry === undefined) return
    const next = new Map(state.snapshot)
    next.set(path, { editor: entry.editor, status: 'ready' })
    commit(next, { type: 'ready', path, editor: entry.editor })
  }

  function remove(path: string): void {
    // Only mutate/emit when the entry existed — matches the no-op-when-absent discipline of markReady,
    // so a redundant remove can't emit a spurious 'removed' (which would resolve a waiter with null).
    if (!state.snapshot.has(path)) return
    const next = new Map(state.snapshot)
    next.delete(path)
    commit(next, { type: 'removed', path })
  }

  function waitUntilReady(path: string): Promise<Editor | null> {
    const entry = state.snapshot.get(path)
    if (entry?.status === 'ready') return Promise.resolve(entry.editor)
    // Otherwise settle off the event stream: the matching 'ready' yields the editor, the matching
    // 'removed' (tab closed before it loaded) yields null. No timer, no heuristic — the payload says
    // which path and which transition, so every case is explicit. Unsubscribe once settled.
    return new Promise((resolve) => {
      const unsubscribe = on((event) => {
        if (event.path !== path) return
        if (event.type === 'ready') {
          unsubscribe()
          resolve(event.editor)
        } else if (event.type === 'removed') {
          unsubscribe()
          resolve(null)
        }
      })
    })
  }

  return { getSnapshot, on, mount, markReady, remove, waitUntilReady }
}

export { createOpenEditorsStore }
export type { OpenEditorsStore, OpenEditorEntry, OpenEditorEvent }
