// Pure calculations for editor zoom: clamping, reading the stored value, and normalizing wheel
// deltas across the browser's three delta modes. Kept separate from the hook so they are testable
// without a DOM.

const EDITOR_ZOOM_STORAGE_KEY = 'editor.zoom'
const DEFAULT_ZOOM = 1
const MIN_ZOOM = 0.75
const MAX_ZOOM = 1.75
const ZOOM_STEP = 0.05
const WHEEL_DELTA_THRESHOLD = 80

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))
}

function readStoredZoom(stored: string | null): number {
  const value = Number(stored)
  return Number.isFinite(value) && stored !== null && stored !== ''
    ? clampZoom(value)
    : DEFAULT_ZOOM
}

function normalizeWheelDelta(event: WheelEvent): number {
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
    return event.deltaY * 16
  }

  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    return event.deltaY * window.innerHeight
  }

  return event.deltaY
}

export {
  EDITOR_ZOOM_STORAGE_KEY,
  DEFAULT_ZOOM,
  MIN_ZOOM,
  MAX_ZOOM,
  ZOOM_STEP,
  WHEEL_DELTA_THRESHOLD,
  clampZoom,
  readStoredZoom,
  normalizeWheelDelta
}
