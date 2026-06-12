// An annotation artifact as a card: severity-tinted label chip, the quoted passage, the agent's note,
// and a Dismiss action. Clicking the card body selects it (the controller activates its editor
// decoration and scrolls to it); the active card carries the accent ring. The severity class sets
// `--annotation-color`, which the chip/divider/quote rules in App.css pick up. Pure props, hook-free.

import { motion } from 'motion/react'
import { annotationSeverityClass } from '../editor/extensions/annotations'
import { cn } from '../components/cn'
import { ArtifactAction } from './ArtifactAction'
import type { AnnotationArtifact } from './artifact'

interface AnnotationCardLabels {
  readonly dismiss: string
}

interface AnnotationCardProps {
  readonly artifact: AnnotationArtifact
  readonly active: boolean
  readonly onClick: () => void
  readonly onDismiss: () => void
  readonly labels: AnnotationCardLabels
}

function AnnotationCard({
  artifact,
  active,
  onClick,
  onDismiss,
  labels
}: AnnotationCardProps): React.JSX.Element {
  return (
    <motion.div
      layout
      data-testid={`artifact-card:${artifact.id}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className={cn(
        annotationSeverityClass[artifact.severity],
        'cursor-pointer rounded-xl border bg-surface-1 p-3 transition-colors',
        active
          ? 'border-action-primary ring-2 ring-action-primary/50'
          : 'border-(--line) hover:bg-(--hover)'
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="annotation-chip text-xs font-semibold uppercase tracking-wide">
          {artifact.label}
        </span>
        <span className="annotation-divider h-px flex-1" />
      </div>
      <div className="annotation-quote mb-2 border-l-2 pl-3 font-editor text-sm italic leading-snug text-text-secondary">
        “{artifact.quote}”
      </div>
      <p className="text-sm leading-normal text-text-primary">{artifact.description}</p>
      <div className="mt-3 flex justify-end">
        <ArtifactAction label={labels.dismiss} onClick={onDismiss} />
      </div>
    </motion.div>
  )
}

export { AnnotationCard }
export type { AnnotationCardProps, AnnotationCardLabels }
