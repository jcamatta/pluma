// useEditorZoom hook (the action layer over editor-zoom-logic): initialises from localStorage, persists
// and clamps on setZoom, returns to the default on resetZoom, and binds ctrl/cmd + wheel on the container
// to zoom in fixed steps while leaving plain wheel scrolling alone. The state API is driven via
// renderHook; the wheel binding needs a real mounted ref, so those cases render a tiny harness component
// that attaches containerRef to a div. The pure math is covered separately in editor-zoom-logic /
// accumulateWheel tests.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, render, renderHook } from '@testing-library/react'
import { useEditorZoom } from '../useEditorZoom'
import {
  DEFAULT_ZOOM,
  EDITOR_ZOOM_STORAGE_KEY,
  WHEEL_DELTA_THRESHOLD,
  ZOOM_STEP
} from '../editor-zoom-logic'

// Renders the hook against a real div so its wheel effect binds, and reports the live zoom back.
function ZoomHarness({ onZoom }: { readonly onZoom: (zoom: number) => void }): React.JSX.Element {
  const { containerRef, zoom } = useEditorZoom()
  onZoom(zoom)
  return <div ref={containerRef} data-testid="zoom-container" />
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('useEditorZoom', () => {
  it('starts at the default zoom when nothing is stored', () => {
    const { result } = renderHook(() => useEditorZoom())

    expect(result.current.zoom).toBe(DEFAULT_ZOOM)
    expect(result.current.zoomPercent).toBe(Math.round(DEFAULT_ZOOM * 100))
  })

  it('reads the stored zoom on mount', () => {
    window.localStorage.setItem(EDITOR_ZOOM_STORAGE_KEY, '1.5')

    const { result } = renderHook(() => useEditorZoom())

    expect(result.current.zoom).toBe(1.5)
    expect(result.current.zoomPercent).toBe(150)
  })

  it('persists and clamps the zoom on setZoom', () => {
    const { result } = renderHook(() => useEditorZoom())

    act(() => result.current.setZoom(10))

    // Clamped below the absurd request, and written through to storage as the same clamped value.
    expect(result.current.zoom).toBeLessThan(10)
    expect(window.localStorage.getItem(EDITOR_ZOOM_STORAGE_KEY)).toBe(String(result.current.zoom))
  })

  it('returns to the default zoom on resetZoom', () => {
    const { result } = renderHook(() => useEditorZoom())

    act(() => result.current.setZoom(1.5))
    expect(result.current.zoom).toBe(1.5)

    act(() => result.current.resetZoom())

    expect(result.current.zoom).toBe(DEFAULT_ZOOM)
    expect(window.localStorage.getItem(EDITOR_ZOOM_STORAGE_KEY)).toBe(String(DEFAULT_ZOOM))
  })
})

describe('useEditorZoom wheel binding', () => {
  it('zooms in on ctrl + wheel up once the threshold is crossed', () => {
    const zooms: number[] = []
    const { getByTestId } = render(<ZoomHarness onZoom={(value) => zooms.push(value)} />)
    const start = zooms[0]

    act(() => {
      getByTestId('zoom-container').dispatchEvent(
        new WheelEvent('wheel', { deltaY: -WHEEL_DELTA_THRESHOLD, ctrlKey: true, cancelable: true })
      )
    })

    expect(zooms[zooms.length - 1]).toBeCloseTo(start + ZOOM_STEP)
  })

  it('prevents the default page zoom on a ctrl + wheel event', () => {
    const { getByTestId } = render(<ZoomHarness onZoom={() => {}} />)
    const event = new WheelEvent('wheel', {
      deltaY: -WHEEL_DELTA_THRESHOLD,
      ctrlKey: true,
      cancelable: true
    })

    act(() => {
      getByTestId('zoom-container').dispatchEvent(event)
    })

    expect(event.defaultPrevented).toBe(true)
  })

  it('ignores a plain wheel event without ctrl or meta', () => {
    const zooms: number[] = []
    const { getByTestId } = render(<ZoomHarness onZoom={(value) => zooms.push(value)} />)
    const start = zooms[0]
    const event = new WheelEvent('wheel', { deltaY: -WHEEL_DELTA_THRESHOLD, cancelable: true })

    act(() => {
      getByTestId('zoom-container').dispatchEvent(event)
    })

    expect(zooms[zooms.length - 1]).toBe(start)
    expect(event.defaultPrevented).toBe(false)
  })
})
