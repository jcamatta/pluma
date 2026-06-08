// The slim tab shown at the left or right edge of the editor area when a side panel is collapsed.
// Clicking it reopens the panel. Ported from the design's EdgeTab, rendered in our tokens. Pure props;
// it carries no state or IPC, so it lives as a shared component (not a view) and may be used anywhere.

import type { ReactNode } from 'react'
import { Button } from '@base-ui/react'

type EdgeTabProps = {
  readonly side: 'left' | 'right'
  readonly label: string
  readonly icon: ReactNode
  readonly onOpen: () => void
  readonly count?: number
}

export function EdgeTab({ side, label, icon, onOpen, count = 0 }: EdgeTabProps): React.JSX.Element {
  const left = side === 'left'
  return (
    <Button
      type="button"
      onClick={onOpen}
      aria-label={label}
      className={`absolute top-1/2 z-30 flex -translate-y-1/2 flex-col items-center gap-2 border border-(--line) bg-surface-3 px-2 py-3 text-text-secondary transition-colors hover:text-text-primary ${
        left ? 'left-0 rounded-r-xl border-l-0' : 'right-0 rounded-l-xl border-r-0'
      }`}
    >
      {icon}
      {count > 0 && (
        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-action-primary text-xs font-bold text-text-on-accent">
          {count}
        </span>
      )}
    </Button>
  )
}
