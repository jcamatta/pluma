// scrollTargetOf resolves the scrollable element for a DOM position (node + offset): a text node yields
// its parent element (text nodes can't be scrolled into view directly); an element node is a boundary
// between children, so the child at the offset is returned — the case that makes a pure insert's preview
// widget scroll into view instead of re-centering the whole editor container.

import { describe, expect, it } from 'vitest'
import { scrollTargetOf } from '../scroll-target'

describe('scrollTargetOf', () => {
  it('returns the parent element of a text node', () => {
    const paragraph = document.createElement('p')
    const text = document.createTextNode('hello')
    paragraph.appendChild(text)
    expect(scrollTargetOf(text, 0)).toBe(paragraph)
  })

  it('returns null for a detached text node with no parent', () => {
    expect(scrollTargetOf(document.createTextNode('orphan'), 0)).toBeNull()
  })

  it('returns the child at the offset for a boundary position in a container', () => {
    const container = document.createElement('div')
    const first = document.createElement('p')
    const widget = document.createElement('div')
    container.append(first, widget)
    // A pure insert resolves to the container with the offset pointing at the inserted widget.
    expect(scrollTargetOf(container, 1)).toBe(widget)
  })

  it('falls back to the preceding child when the offset is at the end', () => {
    const container = document.createElement('div')
    const last = document.createElement('p')
    container.appendChild(last)
    // An insert at the document end resolves past the last child; scroll that last block.
    expect(scrollTargetOf(container, 1)).toBe(last)
  })

  it('returns the element itself when it has no children to target', () => {
    const empty = document.createElement('div')
    expect(scrollTargetOf(empty, 0)).toBe(empty)
  })
})
