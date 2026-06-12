// Wires the conversation rail: resolves i18n labels, owns the composer's local value, and runs a turn
// against the live agent. The conversation is agent.messages (the AbstractAgent transcript): splitConversation
// peels the current turn (the last user message onward) from the settled history, which renders above as
// plain bubbles (TranscriptView). The current turn renders as a ConversationTurn whose assistant side is the
// live AgentActivity from useAgentActivityLog (Thinking → Worked/reply). Submitting adds the user message
// and starts a run; Stop aborts it. Closing the rail is lifted to the app shell (like the explorer). Before
// the first message the rail shows its empty state.

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAgent } from '../agent/useAgent'
import { useAgentActivityLog } from './useAgentActivityLog'
import { ConversationRailView } from './ConversationRail.view'
import { TranscriptView } from './Transcript.view'
import { ConversationTurnView } from './ConversationTurn.view'
import { splitConversation } from './transcript-logic'

interface ConversationRailControllerProps {
  readonly onClose: () => void
}

export function ConversationRailController({
  onClose
}: ConversationRailControllerProps): React.JSX.Element {
  const { t } = useTranslation()
  const { agent } = useAgent()
  const [value, setValue] = useState('')
  // The user's explicit expand/collapse override for the current turn's activity; null means "follow
  // the run" — open while it streams its steps, tidied closed once it finishes. A toggle sets it; a
  // new turn clears it. Derived (not an effect) so the activity opens/closes without cascading renders.
  const [expandOverride, setExpandOverride] = useState<boolean | null>(null)

  const activity = useAgentActivityLog(agent, {
    calling: (tool) => t('rail.calling', { tool }),
    done: (tool) => t('rail.done', { tool }),
    runError: (message) => t('rail.runError', { message })
  })

  const working = activity.status === 'working'
  const expanded = expandOverride ?? working

  // A live turn (a run working, settled, or failed — i.e. not idle) is rendered by the activity below the
  // history; only a never-run conversation folds entirely into the plain history.
  const { history, currentPrompt } = splitConversation(agent.messages, activity.status !== 'idle')
  const title = history.find((item) => item.role === 'user')?.text ?? currentPrompt

  const submit = (): void => {
    const text = value.trim()
    if (text.length === 0 || working) return
    setValue('')
    setExpandOverride(null)
    agent.addMessage({ id: crypto.randomUUID(), role: 'user', content: text })
    void agent.runAgent()
  }

  const newChat = (): void => {
    setValue('')
    setExpandOverride(null)
    agent.setMessages([])
  }

  return (
    <ConversationRailView
      labels={{
        chats: t('rail.chats'),
        newChat: t('rail.newChat'),
        collapse: t('rail.collapse'),
        newChatEmpty: t('rail.newChatEmpty'),
        composerPlaceholder: t('rail.composerPlaceholder'),
        send: t('rail.send'),
        toSend: t('rail.toSend'),
        stop: t('rail.stop')
      }}
      title={title ?? t('rail.newChat')}
      hasTurn={history.length > 0 || currentPrompt !== null}
      working={working}
      value={value}
      onChange={setValue}
      onSubmit={submit}
      onStop={() => agent.abortRun()}
      onNewChat={newChat}
      onClose={onClose}
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
          expanded={expanded}
          onToggleExpand={() => setExpandOverride(!expanded)}
        />
      )}
    </ConversationRailView>
  )
}

export type { ConversationRailControllerProps }
