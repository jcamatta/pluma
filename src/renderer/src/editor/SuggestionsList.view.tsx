// The grouped List popover: a right-aligned Base UI popover, anchored to the sub-topbar's List button, that
// lists one editor's suggestions in three sections — Rewrites · Inserts · Notes (empty sections omitted).
// Each row shows a one-line MiniPreview and jumps to the suggestion on click; pending rows carry per-row
// accept / reject / mark-read actions (see SuggestionsListGroup.view). Pure props — open state, the live
// list, the anchor, and every callback are owned by the controller; this only lays out the popover shell,
// animates it, and splits the list into its ordered groups.

import { Popover } from '@base-ui/react/popover'
import { motion } from 'motion/react'
import { SuggestionsGroup } from './SuggestionsListGroup.view'
import type { Suggestion, SuggestionType } from './suggestion-list'

interface SuggestionsListLabels {
  readonly rewrites: string
  readonly inserts: string
  readonly notes: string
  readonly read: string
  readonly conflicted: string
  readonly accept: string
  readonly reject: string
  readonly markRead: string
}

// The four per-row review callbacks, bundled so each row passes one prop instead of drilling all of them.
interface SuggestionsListActions {
  readonly onJump: (item: Suggestion) => void
  readonly onAccept: (item: Suggestion) => void
  readonly onReject: (item: Suggestion) => void
  readonly onMarkRead: (item: Suggestion) => void
}

interface SuggestionsListProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly anchor: React.RefObject<HTMLElement | null>
  readonly items: readonly Suggestion[]
  readonly labels: SuggestionsListLabels
  readonly actions: SuggestionsListActions
  readonly reduceMotion: boolean
}

interface GroupSpec {
  readonly type: SuggestionType
  readonly title: keyof SuggestionsListLabels
}

// The three sections in the order the design fixes; the empty ones are dropped at render.
const groupOrder: readonly GroupSpec[] = [
  { type: 'rewrite', title: 'rewrites' },
  { type: 'insert', title: 'inserts' },
  { type: 'note', title: 'notes' }
]

// One-line rendering of a suggestion: a rewrite strikes its `before` and greens its `after`; an insert is
// green; a note is its quoted passage in the editor face. No interactivity — the row owns the click.
function MiniPreview({ item }: { readonly item: Suggestion }): React.JSX.Element {
  if (item.type === 'note') {
    return <span className="font-editor italic text-text-secondary">{`“${item.quote}”`}</span>
  }
  if (item.type === 'insert') {
    return <span className="font-editor text-feedback-success">{item.after}</span>
  }
  return (
    <span className="font-editor">
      <span className="text-text-muted line-through">{item.before}</span>{' '}
      <span className="text-feedback-success">{item.after}</span>
    </span>
  )
}

function SuggestionsList({
  open,
  onOpenChange,
  anchor,
  items,
  labels,
  actions,
  reduceMotion
}: SuggestionsListProps): React.JSX.Element {
  const groups = groupOrder
    .map((group) => ({
      ...group,
      items: items.filter((item) => item.type === group.type)
    }))
    .filter((group) => group.items.length > 0)

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Portal>
        <Popover.Positioner anchor={anchor} side="bottom" align="end" sideOffset={8}>
          <Popover.Popup
            className="w-80 rounded-xl border border-border bg-surface-1 p-2 shadow-lg"
            render={
              <motion.div
                initial={reduceMotion ? undefined : { opacity: 0, scale: 0.96 }}
                animate={reduceMotion ? undefined : { opacity: 1, scale: 1 }}
              />
            }
          >
            {groups.map((group) => (
              <SuggestionsGroup
                key={group.type}
                type={group.type}
                title={labels[group.title]}
                items={group.items}
                labels={labels}
                actions={actions}
              />
            ))}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

export { SuggestionsList, MiniPreview }
export type { SuggestionsListProps, SuggestionsListLabels, SuggestionsListActions }
