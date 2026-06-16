// suggestion-scroll reveals a position by resolving it to a DOM node (editor.view.domAtPos) and scrolling
// that element natively, centered. It must NOT use ProseMirror's own scroll path (view.scrollIntoView),
// which cannot drive the Base UI ScrollArea viewport. Driven through a real headless editor so domAtPos
// resolves against the real manuscript DOM.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTestEditor } from '../extensions/__tests__/editor-test-harness'
import { reveal, scrollTargetOf } from '../suggestion-scroll'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('scrollTargetOf', () => {
  it('returns an element node unchanged', () => {
    const element = document.createElement('p')
    expect(scrollTargetOf(element)).toBe(element)
  })

  it('returns the parent element of a text node', () => {
    const paragraph = document.createElement('p')
    const text = document.createTextNode('hello')
    paragraph.appendChild(text)
    expect(scrollTargetOf(text)).toBe(paragraph)
  })

  it('returns null for a detached text node with no parent', () => {
    expect(scrollTargetOf(document.createTextNode('orphan'))).toBeNull()
  })
})

describe('reveal', () => {
  it('scrolls the resolved element into the center of the viewport natively', () => {
    const editor = createTestEditor('The quick brown fox jumps over the lazy dog.')
    const scrollIntoView = vi
      .spyOn(Element.prototype, 'scrollIntoView')
      .mockImplementation(() => undefined)
    // ProseMirror's own scroll path runs through editor.commands.scrollIntoView; spying it proves reveal
    // never reaches for it (it cannot drive the Base UI ScrollArea viewport).
    const pmScrollIntoView = vi.spyOn(editor.commands, 'scrollIntoView')
    try {
      reveal(editor, 6)

      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' })
      expect(pmScrollIntoView).not.toHaveBeenCalled()
    } finally {
      editor.destroy()
    }
  })
})
