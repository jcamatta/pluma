// Popup placement: below the caret by default, flipped above when there is more room there, with the height
// capped to the available space so the menu is never clipped off the bottom of the screen.

import { describe, expect, it } from 'vitest'
import { slashMenuPlacement } from '../slash-menu-position-logic'

describe('slashMenuPlacement', () => {
  it('opens below the caret when there is room, capped to the preferred height', () => {
    const placement = slashMenuPlacement({ top: 100, bottom: 120, left: 50 }, 800)
    expect(placement).toEqual({ left: 50, top: 124, bottom: null, maxHeight: 420 })
  })

  it('flips above the caret when there is much more room above (near the bottom edge)', () => {
    const placement = slashMenuPlacement({ top: 760, bottom: 780, left: 50 }, 800)
    expect(placement.top).toBeNull()
    expect(placement.bottom).toBe(800 - (760 - 4))
    expect(placement.left).toBe(50)
    expect(placement.maxHeight).toBe(420)
  })

  it('caps the height to the space below when it stays below but cannot fit the full menu', () => {
    const placement = slashMenuPlacement({ top: 100, bottom: 480, left: 0 }, 660)
    expect(placement.top).toBe(484)
    expect(placement.bottom).toBeNull()
    expect(placement.maxHeight).toBe(660 - 480 - 4 - 8)
  })
})
