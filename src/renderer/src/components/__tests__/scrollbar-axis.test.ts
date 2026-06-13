// scrollbarAxis picks the Tailwind sizing fragments for the scrollbar and thumb from the orientation:
// width for vertical, height for horizontal.

import { describe, expect, it } from 'vitest'
import { scrollbarAxis } from '../scrollbar-axis'

describe('scrollbarAxis', () => {
  it('sizes the scrollbar and thumb by width when vertical', () => {
    expect(scrollbarAxis('vertical')).toEqual({ scrollbar: 'w-2', thumb: 'w-full' })
  })

  it('sizes the scrollbar and thumb by height when horizontal', () => {
    expect(scrollbarAxis('horizontal')).toEqual({ scrollbar: 'h-2', thumb: 'h-full' })
  })
})
