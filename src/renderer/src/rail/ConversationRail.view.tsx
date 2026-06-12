// Pure right-hand rail. Two tabs sit under the header: Chat (the conversation + composer) and Review (the
// artifacts the agent produced, supplied as the `review` slot, with a count badge). Holds no hooks beyond
// render and no IPC; data, callbacks, and resolved label strings all arrive through props from
// ConversationRail.controller. The turn body is a slot (`children`) the controller fills with the
// ConversationTurn; until then it shows the empty state. Rendered in our design tokens.

import { History, PanelRight, Plus, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@base-ui/react'
import { motion } from 'motion/react'
import { IconButton } from '../components/IconButton'
import { Scrollable } from '../components/Scrollable'
import { cn } from '../components/cn'
import { Empty } from './Empty.view'
import { RailComposer } from './RailComposer.view'
import type { RunControlSelectProps } from './RunControlSelect.view'

type RailTab = 'chat' | 'review'

interface RailLabels {
  readonly chats: string
  readonly newChat: string
  readonly collapse: string
  readonly newChatEmpty: string
  readonly composerPlaceholder: string
  readonly send: string
  readonly toSend: string
  readonly stop: string
  readonly chatTab: string
  readonly reviewTab: string
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
  // The composer's model/effort selectors, built by the controller (value + translated options + change
  // handler) and rendered in the composer footer.
  readonly model: RunControlSelectProps
  readonly effort: RunControlSelectProps
  readonly onChange: (value: string) => void
  readonly onSubmit: () => void
  readonly onStop: () => void
  readonly onNewChat: () => void
  readonly onShowThreads: () => void
  readonly onClose: () => void
  readonly tab?: RailTab
  readonly onTab?: (tab: RailTab) => void
  readonly reviewCount?: number
  readonly review?: ReactNode
}

function TabButton({
  label,
  active,
  count,
  onClick
}: {
  readonly label: string
  readonly active: boolean
  readonly count: number
  readonly onClick: () => void
}): React.JSX.Element {
  return (
    <Button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 rounded-lg px-3 py-1 text-sm font-semibold transition-colors',
        active ? 'bg-action-primary text-text-on-accent' : 'text-text-secondary hover:bg-(--hover)'
      )}
      render={
        <motion.button whileTap={{ scale: 0.96 }}>
          {label}
          {count > 0 && (
            <span
              className={cn(
                'flex min-w-4 items-center justify-center rounded-full px-1 text-xs font-bold',
                active
                  ? 'bg-text-on-accent/20 text-text-on-accent'
                  : 'bg-action-primary text-text-on-accent'
              )}
            >
              {count}
            </span>
          )}
        </motion.button>
      }
    />
  )
}

function ChatPane({
  labels,
  children,
  hasTurn,
  working,
  value,
  model,
  effort,
  onChange,
  onSubmit,
  onStop
}: Pick<
  ConversationRailViewProps,
  | 'labels'
  | 'children'
  | 'hasTurn'
  | 'working'
  | 'value'
  | 'model'
  | 'effort'
  | 'onChange'
  | 'onSubmit'
  | 'onStop'
>): React.JSX.Element {
  return (
    <>
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
        model={model}
        effort={effort}
        onChange={onChange}
        onSubmit={onSubmit}
        onStop={onStop}
      />
    </>
  )
}

export function ConversationRailView(props: ConversationRailViewProps): React.JSX.Element {
  const { labels, title, onNewChat, onShowThreads, onClose } = props
  const { tab = 'chat', onTab = () => undefined, reviewCount = 0, review = null } = props

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

      <div className="flex gap-1 border-b border-(--line) px-3 py-2">
        <TabButton
          label={labels.chatTab}
          active={tab === 'chat'}
          count={0}
          onClick={() => onTab('chat')}
        />
        <TabButton
          label={labels.reviewTab}
          active={tab === 'review'}
          count={reviewCount}
          onClick={() => onTab('review')}
        />
      </div>

      {tab === 'chat' ? (
        <ChatPane
          labels={labels}
          hasTurn={props.hasTurn}
          working={props.working}
          value={props.value}
          model={props.model}
          effort={props.effort}
          onChange={props.onChange}
          onSubmit={props.onSubmit}
          onStop={props.onStop}
        >
          {props.children}
        </ChatPane>
      ) : (
        <Scrollable className="min-h-0 flex-1">{review}</Scrollable>
      )}
    </div>
  )
}

export type { RailLabels, RailTab, ConversationRailViewProps }
