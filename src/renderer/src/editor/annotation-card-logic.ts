// Pure geometry for the annotation floating card: given the clicked annotation's screen rect and the
// viewport size, compute the card's clamped top/left so it sits just below the passage without spilling
// off-screen. Kept side-effect-free so it is unit-testable without a DOM (the controller measures the
// rect via the editor view's coordsAtPos and passes plain numbers in).

// Approximate card footprint used only to keep it inside the viewport; the real height is content-driven
// but clamping against a generous bound is enough to avoid the card overflowing the bottom/right edge.
const cardWidth = 320
const cardHeight = 280
const edgeGap = 16
const belowGap = 8

type CardAnchor = {
  // The clicked passage's screen rect (from the editor view's coordsAtPos: top/bottom/left of the
  // first character).
  readonly top: number
  readonly bottom: number
  readonly left: number
}

type Viewport = {
  readonly width: number
  readonly height: number
}

type CardPosition = {
  readonly top: number
  readonly left: number
}

function clampCardPosition(anchor: CardAnchor, viewport: Viewport): CardPosition {
  const top = Math.min(anchor.bottom + belowGap, viewport.height - cardHeight)
  const left = Math.min(Math.max(anchor.left, edgeGap), viewport.width - cardWidth - edgeGap)
  return { top: Math.max(top, edgeGap), left: Math.max(left, edgeGap) }
}

export { clampCardPosition, cardWidth }
export type { CardAnchor, Viewport, CardPosition }
