// A pending gated-tool approval as a card in the rail: an action label, the path(s) the agent wants to
// touch, and Approve / Reject. The agent's run is suspended on this decision, so the card stays until the
// user answers. Pure props — the controller parses the call's args into `paths` and resolves the
// translated label strings; this only lays out and animates. Tokens-only, Base UI Button, Motion entrance.

import { Check, X } from 'lucide-react'
import { Button } from '@base-ui/react'
import { motion } from 'motion/react'
import { cn } from '../components/cn'
import type { ApprovalPaths } from '../agent/approval-logic'

interface ApprovalCardLabels {
  readonly action: string
  readonly approve: string
  readonly reject: string
}

interface ApprovalCardProps {
  readonly toolCallId: string
  readonly paths: ApprovalPaths
  readonly labels: ApprovalCardLabels
  readonly onApprove: () => void
  readonly onReject: () => void
}

function ActionButton({
  label,
  primary,
  icon,
  onClick
}: {
  readonly label: string
  readonly primary: boolean
  readonly icon: React.JSX.Element
  readonly onClick: () => void
}): React.JSX.Element {
  return (
    <Button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        'flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-semibold transition-colors',
        primary
          ? 'bg-action-primary text-text-on-accent'
          : 'border border-(--line2) text-text-secondary hover:bg-(--hover)'
      )}
      render={
        <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
          {icon}
          {label}
        </motion.button>
      }
    />
  )
}

function PathBlock({ paths }: { readonly paths: ApprovalPaths }): React.JSX.Element | null {
  if (paths.kind === 'create' || paths.kind === 'delete') {
    return (
      <span className="block break-all font-editor text-sm text-text-primary">{paths.path}</span>
    )
  }
  if (paths.kind === 'rename') {
    return (
      <span className="block break-all font-editor text-sm text-text-primary">
        <span>{paths.oldPath}</span>
        <span className="px-1 text-text-muted">→</span>
        <span>{paths.newPath}</span>
      </span>
    )
  }
  return null
}

function ApprovalCard({
  paths,
  labels,
  onApprove,
  onReject
}: ApprovalCardProps): React.JSX.Element {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="rounded-xl border border-(--line) bg-surface-1 p-3"
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-action-primary">
          {labels.action}
        </span>
        <span className="h-px flex-1 bg-action-primary/25" />
      </div>
      <PathBlock paths={paths} />
      <div className="mt-3 flex justify-end gap-2">
        <ActionButton
          label={labels.reject}
          primary={false}
          icon={<X size={13} />}
          onClick={onReject}
        />
        <ActionButton
          label={labels.approve}
          primary
          icon={<Check size={13} />}
          onClick={onApprove}
        />
      </div>
    </motion.div>
  )
}

export { ApprovalCard }
export type { ApprovalCardProps, ApprovalCardLabels }
