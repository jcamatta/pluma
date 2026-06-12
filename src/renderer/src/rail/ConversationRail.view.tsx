// Pure right-hand conversation rail, ported from the design's ConversationRail (conversation
// experience). Holds no hooks beyond render and no IPC; data, callbacks, and resolved label strings all
// arrive through props from ConversationRail.controller. Rendered in our design tokens. This is the
// chat view only — the chats-list view and ChatListRow are deferred until threads persist (Plan 04 Q5).
// The turn body is a slot (`children`) the controller fills with the ConversationTurn once built (F3);
// until then it shows the empty state.

import { History, PanelRight, Plus, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { IconButton } from '../components/IconButton'
import { Scrollable } from '../components/Scrollable'
import { Empty } from './Empty.view'
import { RailComposer } from './RailComposer.view'

interface RailLabels {
  readonly chats: string
  readonly newChat: string
  readonly collapse: string
  readonly newChatEmpty: string
  readonly composerPlaceholder: string
  readonly send: string
  readonly toSend: string
  readonly stop: string
}

interface ConversationRailViewProps {
  readonly labels: RailLabels
  // The title shown in the chat header (the run's prompt, or newChat before the first message).
  readonly title: string
  // The turn content; when absent the empty state is shown.
  readonly children?: ReactNode
  readonly hasTurn: boolean
  // Whether a run is in flight: the composer swaps Send for Stop and blocks resubmission.
  readonly working: boolean
  readonly value: string
  readonly onChange: (value: string) => void
  readonly onSubmit: () => void
  readonly onStop: () => void
  readonly onNewChat: () => void
  readonly onShowThreads: () => void
  readonly onClose: () => void
}

export function ConversationRailView({
  labels,
  title,
  children,
  hasTurn,
  working,
  value,
  onChange,
  onSubmit,
  onStop,
  onNewChat,
  onShowThreads,
  onClose
}: ConversationRailViewProps): React.JSX.Element {
  return (
    <div
      className="flex h-full flex-col rounded-2xl bg-surface-3"
      style={{ width: 'var(--rail-w)' }}
      data-testid="conversation-rail"
    >
      <div className="flex items-center gap-2 border-b border-(--line) py-4 pl-4 pr-3">
        <span className="ml-1 flex-1 truncate text-sm font-semibold tracking-tight">{title}</span>
        <IconButton label={labels.newChat} onClick={onNewChat} className="rounded-lg">
          <Plus size={17} />
        </IconButton>
        <IconButton label={labels.chats} onClick={onShowThreads} className="rounded-lg">
          <History size={17} />
        </IconButton>
        <IconButton label={labels.collapse} onClick={onClose} className="rounded-lg">
          <PanelRight size={17} />
        </IconButton>
      </div>

      <Scrollable className="min-h-0 flex-1" contentClassName="px-4 pb-2 pt-4">
        {hasTurn ? children : <Empty icon={<Sparkles size={22} />} text={labels.newChatEmpty} />}
      </Scrollable>

      <RailComposer
        placeholder={labels.composerPlaceholder}
        toSend={labels.toSend}
        send={labels.send}
        stop={labels.stop}
        working={working}
        value={value}
        onChange={onChange}
        onSubmit={onSubmit}
        onStop={onStop}
      />
    </div>
  )
}

export type { RailLabels, ConversationRailViewProps }
