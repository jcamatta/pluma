// Editor zoom hook: holds the current zoom, persists it, and binds ctrl/cmd + wheel to zoom the
// editor in fixed steps. Pure math lives in editor-zoom-logic; this hook is the action layer.

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  clampZoom,
  DEFAULT_ZOOM,
  EDITOR_ZOOM_STORAGE_KEY,
  normalizeWheelDelta,
  readStoredZoom,
  WHEEL_DELTA_THRESHOLD,
  ZOOM_STEP
} from './editor-zoom-logic'

type UseEditorZoom = {
  readonly containerRef: React.RefObject<HTMLDivElement | null>
  readonly zoom: number
  readonly zoomPercent: number
  readonly setZoom: (zoom: number) => void
  readonly resetZoom: () => void
}

type WheelAccumulator = {
  readonly delta: number
  readonly direction: number
}

type WheelOutcome = {
  readonly accumulator: WheelAccumulator
  readonly steps: number
  readonly direction: number
}

const initialAccumulator: WheelAccumulator = { delta: 0, direction: 0 }

function persistZoom(zoom: number): void {
  window.localStorage.setItem(EDITOR_ZOOM_STORAGE_KEY, String(zoom))
}

function accumulateWheel(accumulator: WheelAccumulator, event: WheelEvent): WheelOutcome {
  const delta = normalizeWheelDelta(event)
  if (delta === 0) {
    return { accumulator, steps: 0, direction: accumulator.direction }
  }

  const direction = delta < 0 ? 1 : -1
  const base = accumulator.direction === direction ? accumulator.delta : 0
  const total = base + Math.abs(delta)

  if (total < WHEEL_DELTA_THRESHOLD) {
    return { accumulator: { delta: total, direction }, steps: 0, direction }
  }

  const steps = Math.min(3, Math.floor(total / WHEEL_DELTA_THRESHOLD))
  return { accumulator: { delta: total % WHEEL_DELTA_THRESHOLD, direction }, steps, direction }
}

function useEditorZoom(): UseEditorZoom {
  const containerRef = useRef<HTMLDivElement>(null)
  const accumulatorRef = useRef<WheelAccumulator>(initialAccumulator)
  const [zoom, setZoomState] = useState(() =>
    readStoredZoom(window.localStorage.getItem(EDITOR_ZOOM_STORAGE_KEY))
  )

  const setZoom = useCallback((nextZoom: number) => {
    const clampedZoom = clampZoom(nextZoom)
    persistZoom(clampedZoom)
    setZoomState(clampedZoom)
  }, [])

  const resetZoom = useCallback(() => {
    setZoom(DEFAULT_ZOOM)
  }, [setZoom])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleWheel = (event: WheelEvent): void => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()

      const outcome = accumulateWheel(accumulatorRef.current, event)
      accumulatorRef.current = outcome.accumulator
      if (outcome.steps === 0) return

      setZoomState((currentZoom) => {
        const nextZoom = clampZoom(currentZoom + outcome.direction * ZOOM_STEP * outcome.steps)
        persistZoom(nextZoom)
        return nextZoom
      })
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => container.removeEventListener('wheel', handleWheel)
  }, [])

  return {
    containerRef,
    zoom,
    zoomPercent: Math.round(zoom * 100),
    setZoom,
    resetZoom
  }
}

export { useEditorZoom, accumulateWheel }
export type { UseEditorZoom, WheelAccumulator, WheelOutcome }
