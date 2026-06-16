// clampCardPosition anchors the card just below the passage and keeps it inside the viewport on every
// edge.

import { describe, expect, it } from 'vitest'
import { clampCardPosition } from '../annotation-card-logic'

const viewport = { width: 1200, height: 800 }

describe('clampCardPosition', () => {
  it('places the card below the passage when there is room', () => {
    const { top, left } = clampCardPosition({ top: 100, bottom: 120, left: 300 }, viewport)
    expect(top).toBe(128)
    expect(left).toBe(300)
  })

  it('lifts the card up so it never spills off the bottom edge', () => {
    const { top } = clampCardPosition({ top: 760, bottom: 780, left: 300 }, viewport)
    expect(top).toBeLessThan(780)
    expect(top).toBeLessThanOrEqual(viewport.height)
  })

  it('pulls the card left so it never spills off the right edge', () => {
    const { left } = clampCardPosition({ top: 100, bottom: 120, left: 1180 }, viewport)
    expect(left).toBeLessThan(1180)
  })

  it('keeps the card off the left and top edges', () => {
    const { top, left } = clampCardPosition({ top: -50, bottom: -30, left: -40 }, viewport)
    expect(top).toBeGreaterThanOrEqual(16)
    expect(left).toBeGreaterThanOrEqual(16)
  })
})
