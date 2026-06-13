// The axis-specific Tailwind fragments a Scrollable applies to its scrollbar and thumb, derived from
// the orientation. Pure string work, split out so the choice is unit-testable without rendering the
// Base UI scroll area — whose scrollbar only mounts under real layout, which jsdom does not provide.

type ScrollOrientation = 'vertical' | 'horizontal'

interface ScrollbarAxis {
  readonly scrollbar: string
  readonly thumb: string
}

function scrollbarAxis(orientation: ScrollOrientation): ScrollbarAxis {
  return orientation === 'horizontal'
    ? { scrollbar: 'h-2', thumb: 'h-full' }
    : { scrollbar: 'w-2', thumb: 'w-full' }
}

export { scrollbarAxis }
export type { ScrollOrientation, ScrollbarAxis }
