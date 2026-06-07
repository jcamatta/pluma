// Test setup: registers @testing-library/jest-dom matchers (toBeInTheDocument, etc.) for all tests,
// and polyfills the DOM APIs jsdom omits that ProseMirror's view layer calls on mount.

import '@testing-library/jest-dom/vitest'

if (typeof document !== 'undefined' && !document.elementFromPoint) {
  document.elementFromPoint = () => null
}

if (typeof Range !== 'undefined' && !Range.prototype.getClientRects) {
  const emptyRectList: DOMRectList = {
    item: () => null,
    length: 0,
    [Symbol.iterator](): ArrayIterator<DOMRect> {
      return [][Symbol.iterator]()
    }
  }
  Range.prototype.getClientRects = () => emptyRectList
  Range.prototype.getBoundingClientRect = () => new DOMRect()
}
