// Applying a slash command against a real headless editor: the trigger text is removed and the current
// block becomes the chosen type. Drives the full extension set via the shared withEditor harness.

import { describe, expect, it } from 'vitest'
import type { Editor, Range } from '@tiptap/core'
import { withEditor } from '../../extensions/__tests__/editor-test-harness'
import { applySlashCommand } from '../apply-slash-command'
import type { SlashCommandId } from '../slash-command-catalog'

const triggerRange = (editor: Editor): Range => ({
  from: 1,
  to: 1 + (editor.state.doc.firstChild?.content.size ?? 0)
})

const firstBlock = (editor: Editor): string => editor.state.doc.firstChild?.type.name ?? ''

const docTypes = (editor: Editor): readonly string[] => {
  const names: string[] = []
  editor.state.doc.descendants((node) => {
    names.push(node.type.name)
    return true
  })
  return names
}

const apply = (editor: Editor, id: SlashCommandId): void =>
  applySlashCommand({ editor, id, range: triggerRange(editor) })

describe('applySlashCommand', () => {
  it('removes the trigger text from the block', () => {
    withEditor('/head', (editor) => {
      apply(editor, 'heading1')
      expect(editor.state.doc.firstChild?.textContent).toBe('')
    })
  })

  it('converts the block to the requested heading level', () => {
    withEditor('/head', (editor) => {
      apply(editor, 'heading2')
      expect(firstBlock(editor)).toBe('heading')
      expect(editor.state.doc.firstChild?.attrs.level).toBe(2)
    })
  })

  it('turns the block into a paragraph for the text command', () => {
    withEditor('/text', (editor) => {
      apply(editor, 'text')
      expect(firstBlock(editor)).toBe('paragraph')
    })
  })

  it('wraps the block in a bulleted list', () => {
    withEditor('/list', (editor) => {
      apply(editor, 'bulletList')
      expect(firstBlock(editor)).toBe('bulletList')
    })
  })

  it('wraps the block in a numbered list', () => {
    withEditor('/num', (editor) => {
      apply(editor, 'orderedList')
      expect(firstBlock(editor)).toBe('orderedList')
    })
  })

  it('wraps the block in a blockquote', () => {
    withEditor('/quote', (editor) => {
      apply(editor, 'quote')
      expect(firstBlock(editor)).toBe('blockquote')
    })
  })

  it('turns the block into a code block', () => {
    withEditor('/code', (editor) => {
      apply(editor, 'codeBlock')
      expect(firstBlock(editor)).toBe('codeBlock')
    })
  })

  it('inserts a horizontal rule for the divider command', () => {
    withEditor('/div', (editor) => {
      apply(editor, 'divider')
      expect(docTypes(editor)).toContain('horizontalRule')
    })
  })
})
