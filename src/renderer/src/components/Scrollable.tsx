// Generic scroll container built on the Base UI ScrollArea primitive. Shared across features; the
// editor uses it to scroll the manuscript while keeping the zoom container fixed, and the tab strip to
// scroll horizontally when the open files outgrow the panel width. The `orientation` prop chooses which
// axis carries the custom scrollbar — vertical by default, so every existing caller is unaffected.

import { ScrollArea } from '@base-ui/react/scroll-area'
import { forwardRef, type ReactNode } from 'react'
import { scrollbarAxis, type ScrollOrientation } from './scrollbar-axis'

type ScrollableProps = {
  readonly children: ReactNode
  readonly orientation?: ScrollOrientation
  readonly className?: string
  readonly contentClassName?: string
  readonly scrollbarClassName?: string
  readonly viewportClassName?: string
}

export const Scrollable = forwardRef<HTMLDivElement, ScrollableProps>(function Scrollable(
  {
    children,
    orientation = 'vertical',
    className,
    contentClassName,
    scrollbarClassName,
    viewportClassName
  },
  viewportRef
) {
  const axis = scrollbarAxis(orientation)
  return (
    <ScrollArea.Root className={`min-h-0 min-w-0 overflow-hidden ${className ?? ''}`}>
      <ScrollArea.Viewport
        className={`h-full min-h-0 w-full ${viewportClassName ?? ''}`}
        ref={viewportRef}
      >
        <ScrollArea.Content className={contentClassName} style={{ minWidth: 0 }}>
          {children}
        </ScrollArea.Content>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar
        orientation={orientation}
        className={`flex touch-none p-1 ${axis.scrollbar} ${scrollbarClassName ?? ''}`}
      >
        <ScrollArea.Thumb className={`rounded-md bg-surface-2 ${axis.thumb}`} />
      </ScrollArea.Scrollbar>
    </ScrollArea.Root>
  )
})
