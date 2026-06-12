// Where the popup sits relative to the caret, in viewport coordinates. Prefers opening below the caret, but
// flips above when there is more room there (so it is never clipped near the bottom of the screen), and caps
// its height to the available space so the inner scroll area stays on screen. Pure geometry — no DOM — so it
// unit-tests directly; the caller passes the caret rect and the viewport height.

type CaretRect = { readonly top: number; readonly bottom: number; readonly left: number }

type MenuPlacement = {
  readonly left: number
  readonly top: number | null
  readonly bottom: number | null
  readonly maxHeight: number
}

const GAP = 4
const EDGE_MARGIN = 8
const PREFERRED_MAX_HEIGHT = 320

function slashMenuPlacement(caret: CaretRect, viewportHeight: number): MenuPlacement {
  const spaceBelow = viewportHeight - caret.bottom - GAP - EDGE_MARGIN
  const spaceAbove = caret.top - GAP - EDGE_MARGIN
  const below = spaceBelow >= PREFERRED_MAX_HEIGHT || spaceBelow >= spaceAbove
  const available = below ? spaceBelow : spaceAbove
  const maxHeight = Math.max(0, Math.min(PREFERRED_MAX_HEIGHT, available))

  return below
    ? { left: caret.left, top: caret.bottom + GAP, bottom: null, maxHeight }
    : { left: caret.left, top: null, bottom: viewportHeight - (caret.top - GAP), maxHeight }
}

export { slashMenuPlacement }
export type { CaretRect, MenuPlacement }
