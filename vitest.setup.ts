// Test setup: registers @testing-library/jest-dom matchers (toBeInTheDocument, etc.) for all tests,
// and polyfills the DOM APIs jsdom omits that ProseMirror's view layer calls on mount.

import '@testing-library/jest-dom/vitest'

if (typeof document !== 'undefined' && !document.elementFromPoint) {
  document.elementFromPoint = () => null
}

// jsdom omits PointerEvent; Base UI's interactive controls (e.g. Radio) construct one on click. Provide a
// minimal subclass of MouseEvent that carries the pointer fields those handlers read.
if (typeof window !== 'undefined' && typeof window.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends window.MouseEvent implements PointerEvent {
    readonly pointerId: number
    readonly width: number
    readonly height: number
    readonly pressure: number
    readonly tangentialPressure: number
    readonly tiltX: number
    readonly tiltY: number
    readonly twist: number
    readonly altitudeAngle: number
    readonly azimuthAngle: number
    readonly pointerType: string
    readonly isPrimary: boolean

    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params)
      this.pointerId = params.pointerId ?? 0
      this.width = params.width ?? 1
      this.height = params.height ?? 1
      this.pressure = params.pressure ?? 0
      this.tangentialPressure = params.tangentialPressure ?? 0
      this.tiltX = params.tiltX ?? 0
      this.tiltY = params.tiltY ?? 0
      this.twist = params.twist ?? 0
      this.altitudeAngle = params.altitudeAngle ?? 0
      this.azimuthAngle = params.azimuthAngle ?? 0
      this.pointerType = params.pointerType ?? ''
      this.isPrimary = params.isPrimary ?? false
    }

    getCoalescedEvents(): PointerEvent[] {
      return []
    }

    getPredictedEvents(): PointerEvent[] {
      return []
    }
  }
  window.PointerEvent = PointerEventPolyfill
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

// jsdom stubs scrollIntoView as "not implemented" (it logs noise on call); the artifacts panel scrolls
// the manuscript to a selected card's range through it. A no-op keeps that path silent under test.
if (typeof Element !== 'undefined') {
  Element.prototype.scrollIntoView = () => undefined
}
