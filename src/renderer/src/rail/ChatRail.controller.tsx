// Wires the chat half of the rail: resolves i18n labels, owns the composer's local value and the per-row
// step-expand overrides, and runs a turn against the live agent. The conversation is rendered directly
// from agent.messages (the single source of truth) via useRailConversation, which projects every turn —
// current and prior — into a row carrying its reply text and derived step timeline. "Working" is driven by
// agent.isRunning and a failed run by the run-error flag, so steps show live and on reload alike.
// Submitting adds the user message and starts a run; Stop aborts it. Opening the threads list and starting
// a new thread are lifted to the parent rail switch; a finished run refreshes the thread list. Before the
// first message the rail shows its empty state.

import type { TFunction } from 'i18next'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAgent } from '../agent/useAgent'
import { ArtifactsPanelController } from '../artifacts/ArtifactsPanel.controller'
import { ContextMeterController } from './ContextMeter.controller'
import { useThreadsRefresh } from './useThreadsRefresh'
import { useReviewTab } from './useReviewTab'
import { useRunControls } from './useRunControls'
import { useRailConversation } from './useRailConversation'
import type { ActivityLabels } from './Activity.view'
import type { StepLabels } from './conversation-rows'
import { ConversationRailView, type RailLabels } from './ConversationRail.view'
import { ConversationView } from './Conversation.view'
import { ApprovalCardController } from './ApprovalCard.controller'

interface ChatRailControllerProps {
  readonly cwd: string
  // The active thread's stored (renameable) name, shown in the header; null falls back to the first message.
  readonly threadTitle: string | null
  readonly onShowThreads: () => void
  readonly onNewThread: () => void
  readonly onClose: () => void
}

// Prefer the thread's stored name so a rename shows in the header; fall back to the first message.
function resolveTitle(threadTitle: string | null, messageTitle: string | null): string | null {
  return threadTitle !== null && threadTitle.length > 0 ? threadTitle : messageTitle
}

function railLabels(t: TFunction): RailLabels {
  return {
    chats: t('threads.open'),
    newChat: t('rail.newChat'),
    collapse: t('rail.collapse'),
    newChatEmpty: t('rail.newChatEmpty'),
    composerPlaceholder: t('rail.composerPlaceholder'),
    send: t('rail.send'),
    stop: t('rail.stop'),
    chatTab: t('rail.chat'),
    reviewTab: t('rail.review')
  }
}

function activityLabels(t: TFunction): ActivityLabels {
  return {
    thinking: t('rail.thinking'),
    worked: t('rail.worked'),
    runFailed: t('rail.runFailed'),
    step: (count) => t('rail.step', { count })
  }
}

function stepLabels(t: TFunction): StepLabels {
  return {
    calling: (tool) => t('rail.calling', { tool }),
    done: (tool) => t('rail.done', { tool }),
    failed: (tool) => t('rail.toolFailed', { tool })
  }
}

export function ChatRailController({
  cwd,
  threadTitle,
  onShowThreads,
  onNewThread,
  onClose
}: ChatRailControllerProps): React.JSX.Element {
  const { t } = useTranslation()
  const { agent } = useAgent()
  const runControls = useRunControls()
  const review = useReviewTab()
  const [value, setValue] = useState('')
  const [overrides, setOverrides] = useState<ReadonlyMap<string, boolean>>(new Map())
  const convo = useRailConversation(agent, stepLabels(t))
  useThreadsRefresh(agent, cwd)

  const submit = (): void => {
    const text = value.trim()
    if (text.length === 0 || agent.isRunning) return
    setValue('')
    setOverrides(new Map())
    agent.addMessage({ id: crypto.randomUUID(), role: 'user', content: text })
    void agent.runAgent({ forwardedProps: { state: runControls.runState } })
  }

  return (
    <ConversationRailView
      labels={railLabels(t)}
      title={resolveTitle(threadTitle, convo.firstUserText) ?? t('rail.newChat')}
      hasTurn={convo.rows.length > 0}
      working={agent.isRunning}
      value={value}
      model={runControls.model}
      effort={runControls.effort}
      contextMeter={<ContextMeterController agent={agent} />}
      approvals={<ApprovalCardController />}
      onChange={setValue}
      onSubmit={submit}
      onStop={() => agent.abortRun()}
      onNewChat={() => {
        setValue('')
        setOverrides(new Map())
        onNewThread()
      }}
      onShowThreads={onShowThreads}
      onClose={onClose}
      tab={review.tab}
      onTab={review.setTab}
      reviewCount={review.reviewCount}
      review={<ArtifactsPanelController />}
    >
      <ConversationView
        rows={convo.rows}
        labels={activityLabels(t)}
        overrides={overrides}
        onSetExpanded={(id, expanded) => setOverrides((prev) => new Map(prev).set(id, expanded))}
        scrollRefId={convo.lastUserId}
        scrollRef={convo.scrollRef}
      />
    </ConversationRailView>
  )
}

export type { ChatRailControllerProps }
