// The grouped List popover: a right-aligned Base UI popover, anchored to the sub-topbar's List button, that
// lists one editor's suggestions in three sections — Rewrites · Inserts · Notes (empty sections omitted).
// Each row shows a one-line MiniPreview of the suggestion and jumps to it in the manuscript on click;
// resolved rows (a read note, a conflicted rewrite) are dimmed and show their status label. This is the
// read-only navigator: per-row and per-group actions arrive in step 7b. Pure props — open state, the live
// list, the anchor, and onJump are owned by the controller; this only lays out and animates.

import { Replace, TextCursorInput, MessageSquareText } from 'lucide-react'
import { Button } from '@base-ui/react'
import { Popover } from '@base-ui/react/popover'
import { motion } from 'motion/react'
import type { Suggestion, SuggestionType } from './suggestion-list'

interface SuggestionsListLabels {
  readonly rewrites: string
  readonly inserts: string
  readonly notes: string
  readonly read: string
  readonly conflicted: string
}

interface SuggestionsListProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly anchor: React.RefObject<HTMLElement | null>
  readonly items: readonly Suggestion[]
  readonly labels: SuggestionsListLabels
  readonly onJump: (item: Suggestion) => void
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

const groupIcon: Record<SuggestionType, typeof Replace> = {
  rewrite: Replace,
  insert: TextCursorInput,
  note: MessageSquareText
}

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

function statusLabel(item: Suggestion, labels: SuggestionsListLabels): string | null {
  if (item.resolution === 'read') return labels.read
  if (item.resolution === 'conflicted') return labels.conflicted
  return null
}

function SuggestionRow({
  item,
  labels,
  onJump
}: {
  readonly item: Suggestion
  readonly labels: SuggestionsListLabels
  readonly onJump: (item: Suggestion) => void
}): React.JSX.Element {
  const status = statusLabel(item, labels)
  return (
    <Button
      type="button"
      onClick={() => onJump(item)}
      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left hover:bg-(--hover) ${item.pending ? '' : 'opacity-50'}`}
    >
      <span className="min-w-0 flex-1 truncate text-xs">
        <MiniPreview item={item} />
      </span>
      {status !== null && (
        <span className="flex-none font-mono text-xs text-text-muted">{status}</span>
      )}
    </Button>
  )
}

function SuggestionsGroup({
  type,
  title,
  items,
  labels,
  onJump
}: {
  readonly type: SuggestionType
  readonly title: string
  readonly items: readonly Suggestion[]
  readonly labels: SuggestionsListLabels
  readonly onJump: (item: Suggestion) => void
}): React.JSX.Element {
  const Icon = groupIcon[type]
  return (
    <div className="mb-1">
      <div className="flex items-center gap-2 px-2 pb-1 pt-2">
        <Icon aria-hidden="true" size={12} className="text-text-secondary" />
        <span className="text-xs font-bold uppercase tracking-wide text-text-secondary">
          {title}
        </span>
        <span className="text-xs text-text-muted">{items.length}</span>
      </div>
      {items.map((item) => (
        <SuggestionRow key={item.id} item={item} labels={labels} onJump={onJump} />
      ))}
    </div>
  )
}

function SuggestionsList({
  open,
  onOpenChange,
  anchor,
  items,
  labels,
  onJump,
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
                onJump={onJump}
              />
            ))}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

export { SuggestionsList, MiniPreview }
export type { SuggestionsListProps, SuggestionsListLabels }
