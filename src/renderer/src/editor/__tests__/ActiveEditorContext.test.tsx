// ActiveEditorContext shares the live editor across columns: the provider starts empty, exposes whatever
// EditorController registers as active, and derives `editors` from the open-editors store it owns;
// reading it outside a provider is a usage error.

import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { ActiveEditorProvider } from '../ActiveEditorProvider'
import { useActiveEditor } from '../ActiveEditorContext'
import { createTestEditor } from '../extensions/__tests__/editor-test-harness'

function wrapper({ children }: { readonly children: ReactNode }): React.JSX.Element {
  return <ActiveEditorProvider>{children}</ActiveEditorProvider>
}

describe('ActiveEditorContext', () => {
  it('starts empty, exposes the registered editor, and clears on deregister', () => {
    const editor = createTestEditor()
    try {
      const { result } = renderHook(useActiveEditor, { wrapper })

      expect(result.current.editor).toBeNull()

      act(() => result.current.register(editor))
      expect(result.current.editor).toBe(editor)

      act(() => result.current.register(null))
      expect(result.current.editor).toBeNull()
    } finally {
      editor.destroy()
    }
  })

  it('derives the open-file editors from the store and drops one on removal', () => {
    const a = createTestEditor()
    const b = createTestEditor()
    try {
      const { result } = renderHook(useActiveEditor, { wrapper })
      act(() => {
        result.current.store.mount('/a.md', a)
        result.current.store.mount('/b.md', b)
      })
      expect([...result.current.editors.keys()]).toEqual(['/a.md', '/b.md'])
      expect(result.current.editors.get('/a.md')).toBe(a)

      act(() => result.current.store.remove('/a.md'))
      expect([...result.current.editors.keys()]).toEqual(['/b.md'])
    } finally {
      a.destroy()
      b.destroy()
    }
  })

  it('throws when used outside an ActiveEditorProvider', () => {
    expect(() => renderHook(useActiveEditor)).toThrow()
  })
})
