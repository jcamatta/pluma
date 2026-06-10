// Wires the conversation rail: resolves i18n labels, owns the composer's local value and the current
// turn's prompt, and runs a turn against the live agent. Submitting adds the user message and starts a
// run; the run's AG-UI event stream is folded into an AgentActivity by useAgentActivityLog, which the
// ConversationTurn renders (user bubble → live activity timeline → streamed reply). Stop aborts the
// run. Closing the rail is lifted to the app shell (like the explorer). Before the first message the
// rail shows its empty state. One turn at a time — the multi-turn chats list is deferred (Plan 04 Q5).

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAgent } from '../agent/useAgent'
import { useAgentActivityLog } from './useAgentActivityLog'
import { ConversationRailView } from './ConversationRail.view'
import { ConversationTurnView } from './ConversationTurn.view'

interface ConversationRailControllerProps {
  readonly onClose: () => void
}

export function ConversationRailController({
  onClose
}: ConversationRailControllerProps): React.JSX.Element {
  const { t } = useTranslation()
  const { agent } = useAgent()
  const [value, setValue] = useState('')
  const [prompt, setPrompt] = useState<string | null>(null)
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

  const submit = (): void => {
    const text = value.trim()
    if (text.length === 0 || activity.status === 'working') return
    setPrompt(text)
    setValue('')
    setExpandOverride(null)
    agent.addMessage({ id: crypto.randomUUID(), role: 'user', content: text })
    void agent.runAgent()
  }

  const newChat = (): void => {
    setValue('')
    setPrompt(null)
    setExpandOverride(null)
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
      title={prompt ?? t('rail.newChat')}
      hasTurn={prompt !== null}
      working={working}
      value={value}
      onChange={setValue}
      onSubmit={submit}
      onStop={() => agent.abortRun()}
      onNewChat={newChat}
      onClose={onClose}
    >
      {prompt !== null && (
        <ConversationTurnView
          prompt={prompt}
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
