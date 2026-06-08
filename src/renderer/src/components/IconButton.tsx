// A small icon button: a Base UI Button rendered as a Motion button so every press is animated
// (grow on hover, shrink on tap). Cross-feature visual primitive — holds no state or IPC. The base
// styling can be overridden through `className` (merged with `cn`), and `stopPropagation` keeps a
// click inside a clickable row from also selecting/toggling that row.

import { Button } from '@base-ui/react'
import { motion } from 'motion/react'
import { cn } from './cn'

type IconButtonProps = {
  readonly label: string
  readonly onClick: () => void
  readonly children: React.ReactNode
  readonly className?: string
  readonly stopPropagation?: boolean
}

function IconButton({
  label,
  onClick,
  children,
  className,
  stopPropagation = false
}: IconButtonProps): React.JSX.Element {
  return (
    <Button
      type="button"
      onClick={(e) => {
        if (stopPropagation) e.stopPropagation()
        onClick()
      }}
      aria-label={label}
      title={label}
      className={cn(
        'flex rounded-md p-1 text-text-muted transition-colors hover:bg-(--hover) hover:text-text-primary',
        className
      )}
      render={
        <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}>
          {children}
        </motion.button>
      }
    />
  )
}

export { IconButton }
export type { IconButtonProps }
