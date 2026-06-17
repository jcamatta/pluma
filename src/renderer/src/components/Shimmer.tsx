// A single pulsing skeleton bar: opacity loops on a staggered delay via Motion, honoring reduced-motion.
// Decorative by default (aria-hidden) — the loading state is announced by the labelled container that
// groups them. Shared by the launcher's workspace preview and the explorer's loading skeleton.

import { motion, useReducedMotion } from 'motion/react'

type ShimmerProps = {
  readonly className: string
  readonly delay?: number
}

function Shimmer({ className, delay = 0 }: ShimmerProps): React.JSX.Element {
  const reduce = useReducedMotion()
  return (
    <motion.span
      aria-hidden="true"
      className={className}
      animate={reduce ? undefined : { opacity: [0.4, 0.85, 0.4] }}
      transition={{ repeat: Infinity, repeatType: 'loop', duration: 2.4, ease: 'easeInOut', delay }}
    />
  )
}

export { Shimmer }
