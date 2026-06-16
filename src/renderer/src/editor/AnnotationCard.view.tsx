// The floating note card opened by clicking an inline annotation: a warning-tinted "Note" header, the
// annotation's bold label, the quoted passage, the agent's note body, the originating tool name, and a
// single Got it / Read control. Pure props — the controller owns the open/anchor state and computes the
// clamped position, passing it in as top/left; this only lays out and animates. Tokens-only, lucide
// icons, Base UI Button, Motion entrance (respecting reduced motion).

import { Check, MessageSquareText } from 'lucide-react'
import { Button } from '@base-ui/react'
import { motion } from 'motion/react'
import type { CSSProperties } from 'react'
import { cn } from '../components/cn'
import type { AnnotationStatus } from './extensions/annotations'

interface AnnotationCardLabels {
  readonly title: string
  readonly gotIt: string
  readonly read: string
}

interface AnnotationCardProps {
  readonly label: string
  readonly quote: string
  readonly description: string
  readonly status: AnnotationStatus
  readonly top: number
  readonly left: number
  readonly reduceMotion: boolean
  readonly labels: AnnotationCardLabels
  readonly onGotIt: () => void
}

function AnnotationCard({
  label,
  quote,
  description,
  status,
  top,
  left,
  reduceMotion,
  labels,
  onGotIt
}: AnnotationCardProps): React.JSX.Element {
  const position: CSSProperties = { top, left }
  const read = status === 'read'

  return (
    <motion.div
      role="dialog"
      aria-label={labels.title}
      data-testid="annotation-card"
      style={position}
      initial={reduceMotion ? false : { opacity: 0, y: 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.16 }}
      className="annotation-warning fixed z-50 w-80 overflow-hidden rounded-xl border border-(--line) bg-surface-3 shadow-(--shadow-2)"
    >
      <div className="flex items-center gap-2 border-b border-(--line) px-4 py-3">
        <MessageSquareText aria-hidden="true" className="annotation-chip size-4" />
        <span className="text-xs font-bold uppercase tracking-wide text-text-muted">
          {labels.title}
        </span>
      </div>
      <div className="px-4 pb-4 pt-3">
        <div className="mb-2 text-sm font-bold text-text-primary">{label}</div>
        <div className="annotation-quote mb-3 border-l-2 pl-3 font-editor text-sm italic leading-snug text-text-secondary">
          “{quote}”
        </div>
        <p className="text-sm leading-normal text-text-primary">{description}</p>
        <div className="mt-4 flex items-center gap-2">
          <span className="font-ui text-xs text-text-muted">create_annotation</span>
          <Button
            type="button"
            disabled={read}
            onClick={onGotIt}
            aria-label={read ? labels.read : labels.gotIt}
            className={cn(
              'ml-auto flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-semibold',
              read
                ? 'bg-feedback-success/15 text-feedback-success'
                : 'bg-action-primary text-text-on-accent'
            )}
            render={
              <motion.button
                whileHover={read ? undefined : { scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
              >
                <Check size={13} />
                {read ? labels.read : labels.gotIt}
              </motion.button>
            }
          />
        </div>
      </div>
    </motion.div>
  )
}

export { AnnotationCard }
export type { AnnotationCardProps, AnnotationCardLabels }
