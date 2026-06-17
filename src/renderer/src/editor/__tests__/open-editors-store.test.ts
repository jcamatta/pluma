// The open-editors store: a single event-driven source of truth. Verifies the map and the event stream
// stay in lockstep, that waitUntilReady settles deterministically off the events (ready -> editor,
// removed -> null, already-ready -> immediate), and that the snapshot has useSyncExternalStore-safe
// identity. Editors are real headless TipTap instances scoped by withEditor (no casts, no stubs).

import { describe, expect, it } from 'vitest'
import type { OpenEditorEvent } from '../open-editors-store'
import { createOpenEditorsStore } from '../open-editors-store'
import { withEditor } from '../extensions/__tests__/editor-test-harness'

const PATH = '/workspace/note.md'

function recordEvents(): { events: OpenEditorEvent[]; sink: (event: OpenEditorEvent) => void } {
  const events: OpenEditorEvent[] = []
  return { events, sink: (event) => events.push(event) }
}

describe('createOpenEditorsStore mutations', () => {
  it('mount creates a loading entry and emits mounted; markReady flips to ready and emits', () => {
    withEditor('hello', (editor) => {
      const store = createOpenEditorsStore()
      const { events, sink } = recordEvents()
      store.on(sink)

      store.mount(PATH, editor)
      expect(store.getSnapshot().get(PATH)).toEqual({ editor, status: 'loading' })
      expect(events).toEqual([{ type: 'mounted', path: PATH, editor }])

      store.markReady(PATH)
      expect(store.getSnapshot().get(PATH)).toEqual({ editor, status: 'ready' })
      expect(events).toEqual([
        { type: 'mounted', path: PATH, editor },
        { type: 'ready', path: PATH, editor }
      ])
    })
  })

  it('markReady on an absent path is a no-op and emits nothing', () => {
    const store = createOpenEditorsStore()
    const { events, sink } = recordEvents()
    store.on(sink)

    store.markReady(PATH)
    expect(store.getSnapshot().has(PATH)).toBe(false)
    expect(events).toEqual([])
  })

  it('remove deletes the entry and emits removed; a remove of an absent path is a no-op', () => {
    withEditor('hello', (editor) => {
      const store = createOpenEditorsStore()
      const { events, sink } = recordEvents()

      store.mount(PATH, editor)
      store.on(sink)
      store.remove(PATH)
      expect(store.getSnapshot().has(PATH)).toBe(false)
      expect(events).toEqual([{ type: 'removed', path: PATH }])

      store.remove(PATH)
      expect(events).toEqual([{ type: 'removed', path: PATH }])
    })
  })

  it('on unsubscribe stops delivery', () => {
    withEditor('hello', (editor) => {
      const store = createOpenEditorsStore()
      const { events, sink } = recordEvents()
      const unsubscribe = store.on(sink)

      store.mount(PATH, editor)
      unsubscribe()
      store.markReady(PATH)

      expect(events).toEqual([{ type: 'mounted', path: PATH, editor }])
    })
  })

  it('getSnapshot identity is stable between mutations and changes on each mutation', () => {
    withEditor('hello', (editor) => {
      const store = createOpenEditorsStore()

      const before = store.getSnapshot()
      expect(store.getSnapshot()).toBe(before)

      store.mount(PATH, editor)
      const afterMount = store.getSnapshot()
      expect(afterMount).not.toBe(before)
      expect(store.getSnapshot()).toBe(afterMount)

      store.markReady(PATH)
      const afterReady = store.getSnapshot()
      expect(afterReady).not.toBe(afterMount)

      store.remove(PATH)
      expect(store.getSnapshot()).not.toBe(afterReady)
    })
  })
})

describe('createOpenEditorsStore waitUntilReady', () => {
  it('resolves on a later ready event', async () => {
    await withEditor('hello', async (editor) => {
      const store = createOpenEditorsStore()
      store.mount(PATH, editor)

      const pending = store.waitUntilReady(PATH)
      store.markReady(PATH)

      await expect(pending).resolves.toBe(editor)
    })
  })

  it('resolves immediately when the entry is already ready', async () => {
    await withEditor('hello', async (editor) => {
      const store = createOpenEditorsStore()
      store.mount(PATH, editor)
      store.markReady(PATH)

      await expect(store.waitUntilReady(PATH)).resolves.toBe(editor)
    })
  })

  it('resolves null when the entry is removed before ready', async () => {
    await withEditor('hello', async (editor) => {
      const store = createOpenEditorsStore()
      store.mount(PATH, editor)

      const pending = store.waitUntilReady(PATH)
      store.remove(PATH)

      await expect(pending).resolves.toBeNull()
    })
  })
})
