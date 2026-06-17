// The editor header's second row: a per-file suggestions manager. Pure props — the controller owns the
// editor's pending count and visibility (both derived from plugin state) and the labels; this only lays out
// and animates. Left side states the review status (Sparkles + "N to review", or a green Check + "All
// reviewed" when nothing is pending); right side toggles all suggestions on/off (Eye/EyeOff) and opens the
// list popover (built in a later step). Tokens-only, lucide icons, Base UI Button, Motion press states
// (respecting reduced motion).

import { Check, ChevronDown, Eye, EyeOff, ListChecks, Sparkles } from 'lucide-react'
import { Button } from '@base-ui/react'
import { motion } from 'motion/react'

interface SuggestionsBarLabels {
  readonly suggestions: string
  readonly toReview: string
  readonly allReviewed: string
  readonly hideAll: string
  readonly showAll: string
  readonly list: string
}

interface SuggestionsBarProps {
  readonly count: number
  readonly visible: boolean
  readonly reduceMotion: boolean
  readonly labels: SuggestionsBarLabels
  readonly onToggleVisible: () => void
  readonly onOpenList: () => void
  // Anchors the list popover (owned by the controller) to the List button without lifting its layout out.
  readonly listButtonRef?: React.Ref<HTMLButtonElement>
  readonly open?: boolean
}

const tap = { scale: 0.97 }

function SuggestionsBar({
  count,
  visible,
  reduceMotion,
  labels,
  onToggleVisible,
  onOpenList,
  listButtonRef,
  open = false
}: SuggestionsBarProps): React.JSX.Element {
  const reviewed = count === 0
  const toggleLabel = visible ? labels.hideAll : labels.showAll
  const tapProps = reduceMotion ? undefined : tap

  return (
    <div className="suggestions-bar flex h-10 flex-none items-center gap-2 border-b border-(--line) px-4">
      <Sparkles aria-hidden="true" size={15} className="text-action-primary" />
      {reviewed ? (
        <span className="flex items-center gap-1 text-sm font-semibold">
          <Check aria-hidden="true" size={14} className="text-feedback-success" />
          {labels.allReviewed}
        </span>
      ) : (
        <span className="text-sm font-semibold">
          {labels.suggestions}{' '}
          <span className="font-medium text-text-muted">· {labels.toReview}</span>
        </span>
      )}
      <span className="ml-auto flex items-center gap-2">
        <Button
          type="button"
          onClick={onToggleVisible}
          aria-label={toggleLabel}
          className="flex h-7 items-center gap-1 rounded-lg border border-(--line2) px-2 text-xs font-semibold text-text-secondary"
          render={
            <motion.button whileTap={tapProps}>
              {visible ? (
                <Eye aria-hidden="true" size={14} />
              ) : (
                <EyeOff aria-hidden="true" size={14} />
              )}
              {toggleLabel}
            </motion.button>
          }
        />
        <Button
          type="button"
          onClick={onOpenList}
          aria-label={labels.list}
          aria-expanded={open}
          className="flex h-7 items-center gap-1 rounded-lg border border-(--line2) px-2 text-xs font-semibold text-text-secondary"
          render={
            <motion.button ref={listButtonRef} whileTap={tapProps}>
              <ListChecks aria-hidden="true" size={14} />
              {labels.list}
              <ChevronDown aria-hidden="true" size={13} className="text-text-muted" />
            </motion.button>
          }
        />
      </span>
    </div>
  )
}

export { SuggestionsBar }
export type { SuggestionsBarProps, SuggestionsBarLabels }
