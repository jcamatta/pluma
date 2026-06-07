// Pure zoom calculations: clamping, reading stored values, and normalizing wheel deltas.

import { describe, expect, it } from 'vitest'
import {
  clampZoom,
  DEFAULT_ZOOM,
  MAX_ZOOM,
  MIN_ZOOM,
  normalizeWheelDelta,
  readStoredZoom
} from '../editor-zoom-logic'

describe('clampZoom', () => {
  it('clamps below the minimum', () => {
    expect(clampZoom(0.1)).toBe(MIN_ZOOM)
  })

  it('clamps above the maximum', () => {
    expect(clampZoom(5)).toBe(MAX_ZOOM)
  })

  it('passes values within range through', () => {
    expect(clampZoom(1.2)).toBe(1.2)
  })
})

describe('readStoredZoom', () => {
  it('returns the default for null', () => {
    expect(readStoredZoom(null)).toBe(DEFAULT_ZOOM)
  })

  it('returns the default for a non-numeric string', () => {
    expect(readStoredZoom('abc')).toBe(DEFAULT_ZOOM)
  })

  it('clamps a stored out-of-range value', () => {
    expect(readStoredZoom('9')).toBe(MAX_ZOOM)
  })

  it('reads a valid stored value', () => {
    expect(readStoredZoom('1.25')).toBe(1.25)
  })
})

describe('normalizeWheelDelta', () => {
  it('returns pixel deltas unchanged', () => {
    const event = new WheelEvent('wheel', { deltaMode: WheelEvent.DOM_DELTA_PIXEL, deltaY: 40 })
    expect(normalizeWheelDelta(event)).toBe(40)
  })

  it('scales line deltas', () => {
    const event = new WheelEvent('wheel', { deltaMode: WheelEvent.DOM_DELTA_LINE, deltaY: 2 })
    expect(normalizeWheelDelta(event)).toBe(32)
  })
})
