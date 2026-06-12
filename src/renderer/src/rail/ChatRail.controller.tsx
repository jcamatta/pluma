// Wires the chat half of the rail: resolves i18n labels, owns the composer's local value, and runs a
// turn against the live agent. The conversation is agent.messages (the AbstractAgent transcript):
// splitConversation peels the current turn (the last user message onward) from the settled history, which
// renders above as plain bubbles (TranscriptView). The current turn renders as a ConversationTurn whose
// assistant side is the live AgentActivity. Submitting adds the user message and starts a run; Stop aborts
// it. Opening the threads list and starting a new thread are lifted to the parent rail switch; a finished
// run refreshes the thread list. Before the first message the rail shows its empty state.

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useAgent } from '../agent/useAgent'
import { ArtifactsPanelController } from '../artifacts/ArtifactsPanel.controller'
import { useAgentActivityLog } from './useAgentActivityLog'
import { useThreadsRefresh } from './useThreadsRefresh'
import { useReviewTab } from './useReviewTab'
import { ConversationRailView, type RailLabels } from './ConversationRail.view'
import { TranscriptView } from './Transcript.view'
import { ConversationTurnView } from './ConversationTurn.view'
import { splitConversation } from './transcript-logic'

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
    toSend: t('rail.toSend'),
    stop: t('rail.stop'),
    chatTab: t('rail.chat'),
    reviewTab: t('rail.review')
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
  const [value, setValue] = useState('')
  const [expandOverride, setExpandOverride] = useState<boolean | null>(null)

  const activity = useAgentActivityLog(agent, {
    calling: (tool) => t('rail.calling', { tool }),
    done: (tool) => t('rail.done', { tool }),
    runError: (message) => t('rail.runError', { message })
  })

  useThreadsRefresh(agent, cwd)
  const review = useReviewTab()

  const working = activity.status === 'working'
  const { history, currentPrompt } = splitConversation(agent.messages, activity.status !== 'idle')
  const title = resolveTitle(
    threadTitle,
    history.find((item) => item.role === 'user')?.text ?? currentPrompt
  )

  const submit = (): void => {
    const text = value.trim()
    if (text.length === 0 || working) return
    setValue('')
    setExpandOverride(null)
    agent.addMessage({ id: crypto.randomUUID(), role: 'user', content: text })
    void agent.runAgent()
  }

  return (
    <ConversationRailView
      labels={railLabels(t)}
      title={title ?? t('rail.newChat')}
      hasTurn={history.length > 0 || currentPrompt !== null}
      working={working}
      value={value}
      onChange={setValue}
      onSubmit={submit}
      onStop={() => agent.abortRun()}
      onNewChat={() => {
        setValue('')
        setExpandOverride(null)
        onNewThread()
      }}
      onShowThreads={onShowThreads}
      onClose={onClose}
      tab={review.tab}
      onTab={review.setTab}
      reviewCount={review.reviewCount}
      review={<ArtifactsPanelController />}
    >
      <TranscriptView items={history} />
      {currentPrompt !== null && (
        <ConversationTurnView
          prompt={currentPrompt}
          activity={activity}
          labels={{
            thinking: t('rail.thinking'),
            worked: t('rail.worked'),
            runFailed: t('rail.runFailed'),
            step: (count) => t('rail.step', { count })
          }}
          expanded={expandOverride ?? working}
          onToggleExpand={() => setExpandOverride(!(expandOverride ?? working))}
        />
      )}
    </ConversationRailView>
  )
}

export type { ChatRailControllerProps }
