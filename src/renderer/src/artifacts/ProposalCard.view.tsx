// A proposal artifact as a card: the rewrite shown as a before/after diff, with Accept / Reject. Clicking
// the card body selects it (the controller activates its editor diff decoration and scrolls to it); the
// active card carries the accent ring. A conflicted proposal — the underlying text drifted since it was
// made — can no longer be applied, so it shows a conflicted badge and offers only Reject. Pure, hook-free.

import { motion } from 'motion/react'
import { cn } from '../components/cn'
import { ArtifactAction } from './ArtifactAction'
import type { ProposalArtifact } from './artifact'

interface ProposalCardLabels {
  readonly proposedRewrite: string
  readonly conflicted: string
  readonly accept: string
  readonly reject: string
}

interface ProposalCardProps {
  readonly artifact: ProposalArtifact
  readonly active: boolean
  readonly onClick: () => void
  readonly onAccept: () => void
  readonly onReject: () => void
  readonly labels: ProposalCardLabels
}

function ProposalCard({
  artifact,
  active,
  onClick,
  onAccept,
  onReject,
  labels
}: ProposalCardProps): React.JSX.Element {
  const conflicted = artifact.status === 'conflicted'

  return (
    <motion.div
      layout
      data-testid={`artifact-card:${artifact.id}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className={cn(
        'cursor-pointer rounded-xl border bg-surface-1 p-3 transition-colors',
        active
          ? 'border-action-primary ring-2 ring-action-primary/50'
          : 'border-(--line) hover:bg-(--hover)'
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-action-primary">
          {labels.proposedRewrite}
        </span>
        <span className="h-px flex-1 bg-action-primary/25" />
        {conflicted && (
          <span className="text-xs font-semibold uppercase tracking-wide text-feedback-warning">
            {labels.conflicted}
          </span>
        )}
      </div>
      <div className="font-editor text-sm leading-relaxed">
        <span className="text-feedback-error line-through">{artifact.originalText}</span>
        <span className="mt-1 block rounded bg-feedback-success/15 px-1 text-feedback-success">
          {artifact.replacementText}
        </span>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <ArtifactAction label={labels.reject} onClick={onReject} />
        {!conflicted && <ArtifactAction label={labels.accept} onClick={onAccept} primary />}
      </div>
    </motion.div>
  )
}

export { ProposalCard }
export type { ProposalCardProps, ProposalCardLabels }
