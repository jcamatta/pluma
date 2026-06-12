// The slash extension against a real headless editor: typing `/` opens the bridge with the catalog, more
// typing filters it, selecting applies the block and closes, removing the trigger closes, and a `/` in the
// middle of a word never opens. Suggestion resolves its items asynchronously, so each assertion waits a
// tick after typing; the editor is built with an async-aware helper so it is not torn down mid-await.

import { describe, expect, it } from 'vitest'
import type { Editor } from '@tiptap/core'
import { createTestEditor } from './editor-test-harness'
import { getSlashBridge } from '../slash-command'
import { slashCommands } from '../../slash/slash-command-catalog'

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

const withEditorAsync = async (run: (editor: Editor) => Promise<void>): Promise<void> => {
  const editor = createTestEditor('')
  try {
    await run(editor)
  } finally {
    editor.destroy()
  }
}

const ids = (editor: Editor): readonly string[] =>
  getSlashBridge(editor)
    .getSnapshot()
    .items.map((item) => item.id)

describe('SlashCommandExtension', () => {
  it('opens the menu with the full catalog when a slash is typed at the start of a block', () =>
    withEditorAsync(async (editor) => {
      editor.commands.insertContent('/')
      await tick()
      const snapshot = getSlashBridge(editor).getSnapshot()
      expect(snapshot.active).toBe(true)
      expect(snapshot.items).toHaveLength(slashCommands.length)
    }))

  it('filters the menu as the query is typed', () =>
    withEditorAsync(async (editor) => {
      editor.commands.insertContent('/head')
      await tick()
      expect(ids(editor)).toEqual(['heading1', 'heading2', 'heading3'])
    }))

  it('applies the selected block and closes the menu', () =>
    withEditorAsync(async (editor) => {
      editor.commands.insertContent('/head')
      await tick()
      getSlashBridge(editor).select(1)
      expect(editor.state.doc.firstChild?.type.name).toBe('heading')
      expect(editor.state.doc.firstChild?.attrs.level).toBe(2)
      expect(editor.state.doc.firstChild?.textContent).toBe('')
      expect(getSlashBridge(editor).getSnapshot().active).toBe(false)
    }))

  it('closes the menu when the trigger is removed', () =>
    withEditorAsync(async (editor) => {
      editor.commands.insertContent('/')
      await tick()
      expect(getSlashBridge(editor).getSnapshot().active).toBe(true)
      editor.commands.deleteRange({ from: 1, to: 2 })
      await tick()
      expect(getSlashBridge(editor).getSnapshot().active).toBe(false)
    }))

  it('does not open for a slash in the middle of a word', () =>
    withEditorAsync(async (editor) => {
      editor.commands.insertContent('and')
      editor.commands.insertContent('/')
      await tick()
      expect(getSlashBridge(editor).getSnapshot().active).toBe(false)
    }))
})
