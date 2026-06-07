// Pure wheel accumulation: deltas below the threshold accrue, crossing it yields zoom steps, and a
// direction change resets the accumulator.

import { describe, expect, it } from 'vitest'
import { accumulateWheel, type WheelAccumulator } from '../useEditorZoom'

function wheel(deltaY: number): WheelEvent {
  return new WheelEvent('wheel', { deltaMode: WheelEvent.DOM_DELTA_PIXEL, deltaY })
}

const start: WheelAccumulator = { delta: 0, direction: 0 }

describe('accumulateWheel', () => {
  it('accrues delta without emitting steps below the threshold', () => {
    const outcome = accumulateWheel(start, wheel(-40))

    expect(outcome.steps).toBe(0)
    expect(outcome.accumulator.delta).toBe(40)
    expect(outcome.direction).toBe(1)
  })

  it('emits a step once the threshold is crossed', () => {
    const outcome = accumulateWheel({ delta: 60, direction: 1 }, wheel(-40))

    expect(outcome.steps).toBe(1)
    expect(outcome.accumulator.delta).toBe(20)
  })

  it('resets the accumulator on a direction change', () => {
    const outcome = accumulateWheel({ delta: 60, direction: 1 }, wheel(40))

    expect(outcome.direction).toBe(-1)
    expect(outcome.accumulator.delta).toBe(40)
  })

  it('returns zero steps for a zero delta', () => {
    expect(accumulateWheel(start, wheel(0)).steps).toBe(0)
  })
})
