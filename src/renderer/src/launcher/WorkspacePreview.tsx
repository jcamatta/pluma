// The animated skeleton shown on the right of the launcher: a low-fidelity preview of the workspace a
// user lands in after picking a folder — a slim explorer column, the open page with "The blank page
// awaits.", and a faint third column peeking in. Pure visual component (no state, no IPC). Every shimmer
// line pulses on a staggered loop via Motion so the preview feels alive without being literal.

import { motion, useReducedMotion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { Folder } from 'lucide-react'

type ShimmerProps = {
  readonly className: string
  readonly delay: number
}

function Shimmer({ className, delay }: ShimmerProps): React.JSX.Element {
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

const EXPLORER_ROWS = [0, 0.15, 0.3, 0.45, 0.6] as const
const PAGE_LINES = [0.2, 0.35, 0.5, 0.65] as const

function WorkspacePreview(): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <div
      aria-label={t('launcher.preview')}
      role="img"
      className="flex h-full w-full items-stretch gap-3 overflow-hidden p-6 font-ui"
    >
      <div className="hidden w-40 flex-none flex-col gap-3 rounded-2xl bg-surface-3 p-4 sm:flex">
        <Shimmer className="h-2 w-16 rounded-full bg-(--line3)" delay={0} />
        <div className="mt-2 flex flex-col gap-3">
          {EXPLORER_ROWS.map((delay, index) => (
            <div key={delay} className="flex items-center gap-2">
              {index === 0 ? (
                <Folder aria-hidden="true" className="size-3 text-action-primary" />
              ) : (
                <span aria-hidden="true" className="size-3 flex-none" />
              )}
              <Shimmer className="h-2 flex-1 rounded-full bg-(--line2)" delay={delay} />
            </div>
          ))}
        </div>
      </div>

      <div className="relative flex min-w-0 flex-1 flex-col gap-4 rounded-2xl bg-surface-3 p-6 pt-16">
        <span className="absolute top-4 right-4 flex max-w-40 items-center gap-2 rounded-full border border-(--line) bg-surface-3 px-3 py-1 text-xs font-semibold tracking-wide text-text-muted uppercase">
          <span className="size-2 flex-none rounded-full bg-action-primary" />
          {t('launcher.previewBadge')}
        </span>
        <h2 className="max-w-xs font-editor text-xl leading-tight font-semibold whitespace-pre-line text-text-primary">
          {t('launcher.previewHeading')}
        </h2>
        <div className="mt-2 flex flex-col gap-3">
          {PAGE_LINES.map((delay) => (
            <Shimmer key={delay} className="h-3 w-full rounded-full bg-(--line2)" delay={delay} />
          ))}
          <Shimmer className="h-3 w-2/3 rounded-full bg-(--line2)" delay={0.8} />
        </div>
      </div>

      <div className="hidden w-40 flex-none rounded-2xl bg-surface-3 opacity-60 lg:block" />
    </div>
  )
}

export { WorkspacePreview }
