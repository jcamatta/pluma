// useSlashMenu reads the bridge reactively: null while inactive, then translated/filtered items once the
// menu opens, and onSelect applies the highlighted block. Drives a real headless editor; Suggestion opens
// asynchronously so the assertions wait for the hook to update. The hook is unmounted before the editor is
// destroyed so no pending re-render reads torn-down storage.

import { describe, expect, it } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { i18n } from '../../../i18n'
import { createTestEditor } from '../../extensions/__tests__/editor-test-harness'
import { useSlashMenu } from '../useSlashMenu'

const wrapper = ({ children }: { readonly children: React.ReactNode }): React.JSX.Element => (
  <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
)

describe('useSlashMenu', () => {
  it('is null while the menu is inactive', () => {
    const editor = createTestEditor('')
    const { result, unmount } = renderHook(() => useSlashMenu(editor), { wrapper })
    try {
      expect(result.current).toBeNull()
    } finally {
      unmount()
      editor.destroy()
    }
  })

  it('exposes translated, filtered items when the menu opens', async () => {
    const editor = createTestEditor('')
    const { result, unmount } = renderHook(() => useSlashMenu(editor), { wrapper })
    try {
      act(() => {
        editor.commands.insertContent('/head')
      })
      await waitFor(() => expect(result.current).not.toBeNull())
      expect(result.current?.items.map((item) => item.id)).toEqual([
        'heading1',
        'heading2',
        'heading3'
      ])
      expect(result.current?.items[0]?.label).toBe('Heading 1')
      expect(result.current?.heading).toBe('Basic blocks')
    } finally {
      unmount()
      editor.destroy()
    }
  })

  it('applies the highlighted block through onSelect', async () => {
    const editor = createTestEditor('')
    const { result, unmount } = renderHook(() => useSlashMenu(editor), { wrapper })
    try {
      act(() => {
        editor.commands.insertContent('/head')
      })
      await waitFor(() => expect(result.current).not.toBeNull())
      act(() => {
        result.current?.onSelect(0)
      })
      expect(editor.state.doc.firstChild?.type.name).toBe('heading')
      expect(editor.state.doc.firstChild?.attrs.level).toBe(1)
    } finally {
      unmount()
      editor.destroy()
    }
  })
})
