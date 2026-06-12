// ActiveEditorContext shares the live editor across columns: the provider starts empty, exposes whatever
// EditorController registers, and clears on deregister; reading it outside a provider is a usage error.

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

  it('tracks open-file editors by path and drops one on unregister', () => {
    const a = createTestEditor()
    const b = createTestEditor()
    try {
      const { result } = renderHook(useActiveEditor, { wrapper })
      act(() => {
        result.current.registerEditor('/a.md', a)
        result.current.registerEditor('/b.md', b)
      })
      expect([...result.current.editors.keys()]).toEqual(['/a.md', '/b.md'])
      expect(result.current.editors.get('/a.md')).toBe(a)

      act(() => result.current.unregisterEditor('/a.md'))
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
