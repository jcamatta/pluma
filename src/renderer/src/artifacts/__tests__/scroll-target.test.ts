// scrollTargetOf resolves the scrollable element for a DOM node: an element is returned as-is, a text
// node yields its parent element (text nodes can't be scrolled into view directly).

import { describe, expect, it } from 'vitest'
import { scrollTargetOf } from '../scroll-target'

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
