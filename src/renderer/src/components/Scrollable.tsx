// Generic scroll container built on the Base UI ScrollArea primitive. Shared across features; the
// editor uses it to scroll the manuscript while keeping the zoom container fixed.

import { ScrollArea } from '@base-ui/react/scroll-area'
import { forwardRef, type ReactNode } from 'react'

type ScrollableProps = {
  readonly children: ReactNode
  readonly className?: string
  readonly contentClassName?: string
  readonly scrollbarClassName?: string
  readonly viewportClassName?: string
}

export const Scrollable = forwardRef<HTMLDivElement, ScrollableProps>(function Scrollable(
  { children, className, contentClassName, scrollbarClassName, viewportClassName },
  viewportRef
) {
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
      <ScrollArea.Scrollbar className={`flex w-2 touch-none p-1 ${scrollbarClassName ?? ''}`}>
        <ScrollArea.Thumb className="w-full rounded-md bg-surface-2" />
      </ScrollArea.Scrollbar>
    </ScrollArea.Root>
  )
})
