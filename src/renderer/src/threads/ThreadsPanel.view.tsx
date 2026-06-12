// Pure threads (chats) panel: a header (title, back, new-thread) over a scrollable list of past
// threads, each row showing its title and a relative-time subtitle and highlighting the active one.
// Holds no hooks and no IPC — rows, labels, and callbacks all arrive through props from
// ThreadsPanel.controller. Rendered in our design tokens; rows fade/rise in on mount via Motion.

import { ArrowLeft, MessagesSquare, Plus } from 'lucide-react'
import { motion } from 'motion/react'
import { IconButton } from '../components/IconButton'
import { Scrollable } from '../components/Scrollable'

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
}

interface ThreadsPanelViewProps {
  readonly labels: ThreadsPanelLabels
  readonly rows: readonly ThreadRow[]
  readonly onSelect: (id: string) => void
  readonly onNewThread: () => void
  readonly onBack: () => void
}

export function ThreadsPanelView({
  labels,
  rows,
  onSelect,
  onNewThread,
  onBack
}: ThreadsPanelViewProps): React.JSX.Element {
  return (
    <div
      className="flex h-full flex-col rounded-2xl bg-surface-3"
      style={{ width: 'var(--rail-w)' }}
      data-testid="threads-panel"
    >
      <div className="flex items-center gap-2 border-b border-(--line) py-4 pl-3 pr-3">
        <IconButton label={labels.back} onClick={onBack} className="rounded-lg">
          <ArrowLeft size={17} />
        </IconButton>
        <span className="flex-1 truncate text-sm font-semibold tracking-tight">{labels.title}</span>
        <IconButton label={labels.newThread} onClick={onNewThread} className="rounded-lg">
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
          rows.map((row) => (
            <motion.button
              key={row.id}
              type="button"
              onClick={() => onSelect(row.id)}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              whileTap={{ scale: 0.98 }}
              data-testid={`thread-row:${row.id}`}
              className={`flex w-full flex-col items-start gap-1 rounded-xl border px-3 py-2 text-left ${
                row.active
                  ? 'border-action-primary bg-surface-2 text-text-primary'
                  : 'border-transparent text-text-secondary hover:bg-(--hover)'
              }`}
            >
              <span className="w-full truncate text-sm font-medium">{row.title}</span>
              <span className="text-xs text-text-muted">{row.subtitle}</span>
            </motion.button>
          ))
        )}
      </Scrollable>
    </div>
  )
}

export type { ThreadRow, ThreadsPanelLabels, ThreadsPanelViewProps }
