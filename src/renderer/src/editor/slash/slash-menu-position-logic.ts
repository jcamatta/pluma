// Where the popup sits relative to the caret. Suggestion reports the caret as viewport coordinates, so the
// menu is fixed-positioned just below it. Pure geometry, separated from the DOM so it unit-tests directly.

type CaretRect = { readonly left: number; readonly bottom: number }

type MenuPosition = { readonly x: number; readonly y: number }

const MENU_GAP = 4

function slashMenuPosition(caret: CaretRect): MenuPosition {
  return { x: caret.left, y: caret.bottom + MENU_GAP }
}

export { slashMenuPosition }
export type { CaretRect, MenuPosition }
