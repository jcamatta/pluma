// Popup placement: just below the caret, in viewport coordinates.

import { describe, expect, it } from 'vitest'
import { slashMenuPosition } from '../slash-menu-position-logic'

describe('slashMenuPosition', () => {
  it('places the menu at the caret left and a small gap below its bottom', () => {
    expect(slashMenuPosition({ left: 120, bottom: 48 })).toEqual({ x: 120, y: 52 })
  })

  it('handles the document origin', () => {
    expect(slashMenuPosition({ left: 0, bottom: 0 })).toEqual({ x: 0, y: 4 })
  })
})
