// A small text action button shared by the artifact cards (Dismiss / Reject / Accept). A Base UI Button
// rendered as a Motion button so each press animates; `primary` uses the accent fill, otherwise an
// outlined secondary. It stops propagation so pressing an action inside a clickable card does not also
// select the card. Plain visual primitive — no hooks, no IPC.

import type { ReactNode } from 'react'
import { Button } from '@base-ui/react'
import { motion } from 'motion/react'
import { cn } from '../components/cn'

interface ArtifactActionProps {
  readonly label: string
  readonly onClick: () => void
  readonly primary?: boolean
  readonly children?: ReactNode
}

function ArtifactAction({
  label,
  onClick,
  primary = false,
  children
}: ArtifactActionProps): React.JSX.Element {
  return (
    <Button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      aria-label={label}
      className={cn(
        'flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-semibold transition-colors',
        primary
          ? 'bg-action-primary text-text-on-accent'
          : 'border border-(--line2) text-text-secondary hover:bg-(--hover)'
      )}
      render={
        <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
          {children}
          {label}
        </motion.button>
      }
    />
  )
}

export { ArtifactAction }
export type { ArtifactActionProps }
