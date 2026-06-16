// One section of the grouped List popover plus its rows. A pending edit row carries accept/reject buttons and
// a pending note row a mark-read button; resolved rows (a read note, a conflicted rewrite) show their status
// label and no action — so a conflicted edit never exposes a plain accept. The group header shows a bulk
// "Accept all" (edits) / "Mark all read" (notes) only while the group has a pending item. Row action buttons
// stop propagation so they never also trigger the row's jump. Pure: layout and the callbacks passed in.

import { Replace, TextCursorInput, MessageSquareText, Check, X } from 'lucide-react'
import { Button } from '@base-ui/react'
import { MiniPreview } from './SuggestionsList.view'
import type { SuggestionsListActions, SuggestionsListLabels } from './SuggestionsList.view'
import type { Suggestion, SuggestionType } from './suggestion-list'

const groupIcon: Record<SuggestionType, typeof Replace> = {
  rewrite: Replace,
  insert: TextCursorInput,
  note: MessageSquareText
}

function statusLabel(item: Suggestion, labels: SuggestionsListLabels): string | null {
  if (item.resolution === 'read') return labels.read
  if (item.resolution === 'conflicted') return labels.conflicted
  return null
}

// A small icon button inside a row; it stops propagation so acting on a suggestion never also jumps to it.
// `tone` is a complete literal hover class (Tailwind can't compile an interpolated variant).
function RowAction({
  label,
  tone,
  icon: Icon,
  onClick
}: {
  readonly label: string
  readonly tone: string
  readonly icon: typeof Check
  readonly onClick: () => void
}): React.JSX.Element {
  return (
    <Button
      type="button"
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      className={`flex-none rounded p-1 text-text-muted ${tone}`}
    >
      <Icon aria-hidden="true" size={14} />
    </Button>
  )
}

function RowActions({
  item,
  labels,
  actions
}: {
  readonly item: Suggestion
  readonly labels: SuggestionsListLabels
  readonly actions: SuggestionsListActions
}): React.JSX.Element | null {
  if (!item.pending) return null
  if (item.type === 'note') {
    return (
      <RowAction
        label={labels.markRead}
        tone="hover:text-feedback-success"
        icon={Check}
        onClick={() => actions.onMarkRead(item)}
      />
    )
  }
  return (
    <>
      <RowAction
        label={labels.accept}
        tone="hover:text-feedback-success"
        icon={Check}
        onClick={() => actions.onAccept(item)}
      />
      <RowAction
        label={labels.reject}
        tone="hover:text-feedback-error"
        icon={X}
        onClick={() => actions.onReject(item)}
      />
    </>
  )
}

function SuggestionRow({
  item,
  labels,
  actions
}: {
  readonly item: Suggestion
  readonly labels: SuggestionsListLabels
  readonly actions: SuggestionsListActions
}): React.JSX.Element {
  const status = statusLabel(item, labels)
  return (
    <Button
      type="button"
      onClick={() => actions.onJump(item)}
      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left hover:bg-(--hover) ${item.pending ? '' : 'opacity-50'}`}
    >
      <span className="min-w-0 flex-1 truncate text-xs">
        <MiniPreview item={item} />
      </span>
      {status !== null && (
        <span className="flex-none font-ui text-xs text-text-muted">{status}</span>
      )}
      <span className="flex flex-none items-center gap-1">
        <RowActions item={item} labels={labels} actions={actions} />
      </span>
    </Button>
  )
}

// The bulk action a group offers over its pending items: edits accept all, notes mark all read. Hidden when
// the group has no pending item. Conflicted edits are pending=false, so they are excluded here automatically.
function GroupAction({
  type,
  pendingCount,
  labels,
  actions
}: {
  readonly type: SuggestionType
  readonly pendingCount: number
  readonly labels: SuggestionsListLabels
  readonly actions: SuggestionsListActions
}): React.JSX.Element | null {
  if (pendingCount === 0) return null
  const isNote = type === 'note'
  return (
    <Button
      type="button"
      onClick={() => (isNote ? actions.onMarkAllRead() : actions.onAcceptGroup(type))}
      className="ml-auto flex-none rounded px-1 font-ui text-xs font-semibold text-action-primary hover:underline"
    >
      {isNote ? labels.markAllRead : labels.acceptAll}
    </Button>
  )
}

function SuggestionsGroup({
  type,
  title,
  items,
  labels,
  actions
}: {
  readonly type: SuggestionType
  readonly title: string
  readonly items: readonly Suggestion[]
  readonly labels: SuggestionsListLabels
  readonly actions: SuggestionsListActions
}): React.JSX.Element {
  const Icon = groupIcon[type]
  const pendingCount = items.filter((item) => item.pending).length
  return (
    <div className="mb-1">
      <div className="flex items-center gap-2 px-2 pb-1 pt-2">
        <Icon aria-hidden="true" size={12} className="text-text-secondary" />
        <span className="text-xs font-bold uppercase tracking-wide text-text-secondary">
          {title}
        </span>
        <span className="text-xs text-text-muted">{items.length}</span>
        <GroupAction type={type} pendingCount={pendingCount} labels={labels} actions={actions} />
      </div>
      {items.map((item) => (
        <SuggestionRow key={item.id} item={item} labels={labels} actions={actions} />
      ))}
    </div>
  )
}

export { SuggestionsGroup }
