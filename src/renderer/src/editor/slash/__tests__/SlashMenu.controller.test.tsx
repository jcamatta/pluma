// The controller renders the popup only when the bridge is active and applies a block when an option is
// clicked. Drives a real headless editor through the full extension set; the menu opens asynchronously. The
// tree is unmounted before the editor is destroyed so no pending re-render reads torn-down storage.

import { describe, expect, it } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { i18n } from '../../../i18n'
import { createTestEditor } from '../../extensions/__tests__/editor-test-harness'
import { SlashMenuController } from '../SlashMenu.controller'

describe('SlashMenuController', () => {
  it('renders nothing until the menu opens, then shows the rows', async () => {
    const editor = createTestEditor('')
    const { unmount } = render(
      <I18nextProvider i18n={i18n}>
        <SlashMenuController editor={editor} />
      </I18nextProvider>
    )
    try {
      expect(screen.queryByRole('listbox')).toBeNull()
      act(() => {
        editor.commands.insertContent('/head')
      })
      expect(await screen.findByRole('listbox')).toBeInTheDocument()
      expect(screen.getAllByRole('option')).toHaveLength(3)
    } finally {
      unmount()
      editor.destroy()
    }
  })

  it('applies the block when an option is clicked', async () => {
    const editor = createTestEditor('')
    const { unmount } = render(
      <I18nextProvider i18n={i18n}>
        <SlashMenuController editor={editor} />
      </I18nextProvider>
    )
    try {
      act(() => {
        editor.commands.insertContent('/head')
      })
      fireEvent.click(await screen.findByRole('option', { name: /Heading 2/ }))
      expect(editor.state.doc.firstChild?.type.name).toBe('heading')
      expect(editor.state.doc.firstChild?.attrs.level).toBe(2)
    } finally {
      unmount()
      editor.destroy()
    }
  })
})
