// Pure threads (chats) panel: a header (title, back, new-thread) over a scrollable list of past
// threads, each row showing its title and a relative-time subtitle and highlighting the active one. A
// row reveals rename (inline title field) and delete affordances on hover; delete opens the confirm
// dialog. Holds no hooks and no IPC — rows, labels, editing state, and callbacks all arrive through props
// from ThreadsPanel.controller. Rendered in our design tokens; rows fade/rise in on mount via Motion.

import { ArrowLeft, MessagesSquare, Pencil, Plus, Trash2 } from 'lucide-react'
import { motion } from 'motion/react'
import { IconButton } from '../components/IconButton'
import { Scrollable } from '../components/Scrollable'
import { ThreadTitleInput } from './ThreadTitleInput'
import { ThreadDeleteDialog } from './ThreadDeleteDialog'
import type { ThreadDeleteDialogLabels } from './ThreadDeleteDialog'

interface ThreadRow {
  readonly id: string
  readonly title: string
  readonly subtitle: string
  readonly active: boolean
}

interface ThreadsPanelLabels {
  readonly title: string
  readonly newThread: string
  readonly back: string
  readonly empty: string
  readonly rename: string
  readonly delete: string
}

interface RowContext {
  readonly rename: string
  readonly delete: string
  readonly editingId: string | null
  readonly onSelect: (id: string) => void
  readonly onStartRename: (id: string) => void
  readonly onCommitRename: (id: string, title: string) => void
  readonly onCancelRename: () => void
  readonly onRequestDelete: (id: string) => void
}

interface ThreadsPanelViewProps {
  readonly labels: ThreadsPanelLabels
  readonly rows: readonly ThreadRow[]
  readonly editingId: string | null
  readonly deleteOpen: boolean
  readonly deleteLabels: ThreadDeleteDialogLabels
  readonly onSelect: (id: string) => void
  readonly onNewThread: () => void
  readonly onBack: () => void
  readonly onStartRename: (id: string) => void
  readonly onCommitRename: (id: string, title: string) => void
  readonly onCancelRename: () => void
  readonly onRequestDelete: (id: string) => void
  readonly onConfirmDelete: () => void
  readonly onCancelDelete: () => void
}

function ThreadRowView({
  row,
  ctx
}: {
  readonly row: ThreadRow
  readonly ctx: RowContext
}): React.JSX.Element {
  return (
    <motion.div
      data-row
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => ctx.onSelect(row.id)}
      data-testid={`thread-row:${row.id}`}
      className={`flex w-full cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-left ${
        row.active
          ? 'border-action-primary bg-surface-2 text-text-primary'
          : 'border-transparent text-text-secondary hover:bg-(--hover)'
      }`}
    >
      {ctx.editingId === row.id ? (
        <ThreadTitleInput
          initialValue={row.title}
          onCommit={(title) => ctx.onCommitRename(row.id, title)}
          onCancel={ctx.onCancelRename}
        />
      ) : (
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="w-full truncate text-sm font-medium">{row.title}</span>
          <span className="text-xs text-text-muted">{row.subtitle}</span>
        </div>
      )}
      <span className="row-actions ml-auto flex flex-none items-center gap-px">
        <IconButton label={ctx.rename} onClick={() => ctx.onStartRename(row.id)} stopPropagation>
          <Pencil size={15} />
        </IconButton>
        <IconButton label={ctx.delete} onClick={() => ctx.onRequestDelete(row.id)} stopPropagation>
          <Trash2 size={15} />
        </IconButton>
      </span>
    </motion.div>
  )
}

export function ThreadsPanelView(props: ThreadsPanelViewProps): React.JSX.Element {
  const { labels, rows, editingId, deleteOpen, deleteLabels } = props
  const ctx: RowContext = {
    rename: labels.rename,
    delete: labels.delete,
    editingId,
    onSelect: props.onSelect,
    onStartRename: props.onStartRename,
    onCommitRename: props.onCommitRename,
    onCancelRename: props.onCancelRename,
    onRequestDelete: props.onRequestDelete
  }

  return (
    <div
      className="flex h-full flex-col rounded-2xl bg-surface-3"
      style={{ width: 'var(--rail-w)' }}
      data-testid="threads-panel"
    >
      <div className="flex items-center gap-2 border-b border-(--line) py-4 pl-3 pr-3">
        <IconButton label={labels.back} onClick={props.onBack} className="rounded-lg">
          <ArrowLeft size={17} />
        </IconButton>
        <span className="flex-1 truncate text-sm font-semibold tracking-tight">{labels.title}</span>
        <IconButton label={labels.newThread} onClick={props.onNewThread} className="rounded-lg">
          <Plus size={17} />
        </IconButton>
      </div>

      <Scrollable className="min-h-0 flex-1" contentClassName="flex flex-col gap-1 px-3 pb-2 pt-3">
        {rows.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-4 py-10 text-center text-text-muted"
          >
            <div className="mb-3 flex justify-center opacity-55">
              <MessagesSquare size={22} />
            </div>
            <div className="mx-auto max-w-60 text-sm leading-normal">{labels.empty}</div>
          </motion.div>
        ) : (
          rows.map((row) => <ThreadRowView key={row.id} row={row} ctx={ctx} />)
        )}
      </Scrollable>

      <ThreadDeleteDialog
        open={deleteOpen}
        labels={deleteLabels}
        onConfirm={props.onConfirmDelete}
        onCancel={props.onCancelDelete}
      />
    </div>
  )
}

export type { ThreadRow, ThreadsPanelLabels, ThreadsPanelViewProps }
