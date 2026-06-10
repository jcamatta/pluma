// Centered empty-state block (icon + one line of muted copy), ported from the design's Empty. Pure
// props; used by the rail for its no-turn / no-chats states. Fades and rises in on mount.

import type { ReactNode } from 'react'
import { motion } from 'motion/react'

interface EmptyProps {
  readonly icon: ReactNode
  readonly text: string
}

export function Empty({ icon, text }: EmptyProps): React.JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="px-4 py-10 text-center text-text-muted"
    >
      <div className="mb-3 flex justify-center opacity-55">{icon}</div>
      <div className="mx-auto max-w-60 text-sm leading-normal">{text}</div>
    </motion.div>
  )
}

export type { EmptyProps }
