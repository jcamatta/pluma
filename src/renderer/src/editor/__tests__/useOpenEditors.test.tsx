// useOpenEditors is the reactive read of the OpenEditorsStore: it returns the live entry snapshot and
// re-renders the caller on every mount/markReady/remove. Driven through the provider's real store.

import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { ActiveEditorProvider } from '../ActiveEditorProvider'
import { useActiveEditor } from '../ActiveEditorContext'
import { createTestEditor } from '../extensions/__tests__/editor-test-harness'
import { useOpenEditors } from '../useOpenEditors'

function wrapper({ children }: { readonly children: ReactNode }): React.JSX.Element {
  return <ActiveEditorProvider>{children}</ActiveEditorProvider>
}

function useHarness(): {
  readonly api: ReturnType<typeof useActiveEditor>
  readonly entries: ReturnType<typeof useOpenEditors>
} {
  return { api: useActiveEditor(), entries: useOpenEditors() }
}

describe('useOpenEditors', () => {
  it('starts empty, then reflects mounts and removes as the store changes', () => {
    const a = createTestEditor()
    const b = createTestEditor()
    try {
      const { result } = renderHook(useHarness, { wrapper })
      expect([...result.current.entries.keys()]).toEqual([])

      act(() => {
        result.current.api.store.mount('/a.md', a)
        result.current.api.store.mount('/b.md', b)
      })
      expect([...result.current.entries.keys()]).toEqual(['/a.md', '/b.md'])
      expect(result.current.entries.get('/a.md')).toEqual({ editor: a, status: 'loading' })

      act(() => result.current.api.store.remove('/a.md'))
      expect([...result.current.entries.keys()]).toEqual(['/b.md'])
    } finally {
      a.destroy()
      b.destroy()
    }
  })

  it('re-renders with the new status when an entry is marked ready', () => {
    const a = createTestEditor()
    try {
      const { result } = renderHook(useHarness, { wrapper })
      act(() => result.current.api.store.mount('/a.md', a))
      expect(result.current.entries.get('/a.md')?.status).toBe('loading')

      act(() => result.current.api.store.markReady('/a.md'))
      expect(result.current.entries.get('/a.md')?.status).toBe('ready')
    } finally {
      a.destroy()
    }
  })
})
