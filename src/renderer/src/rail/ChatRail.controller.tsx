// Wires the chat half of the rail: owns the composer's local value and the current turn's prompt, and
// runs a turn against the live agent. Submitting adds the user message and starts a run; the run's
// AG-UI event stream is folded into an AgentActivity by useAgentActivityLog, which the ConversationTurn
// renders (user bubble → live activity timeline → streamed reply). Stop aborts the run. Opening the
// threads list, starting a new thread, and closing the rail are lifted to the parent rail controller.

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAgent } from '../agent/useAgent'
import { useAgentActivityLog } from './useAgentActivityLog'
import { ConversationHistoryController } from './ConversationHistory.controller'
import { ConversationRailView } from './ConversationRail.view'
import { ConversationTurnView } from './ConversationTurn.view'

interface ChatRailControllerProps {
  readonly cwd: string
  readonly selectedId: string | null
  readonly onShowThreads: () => void
  readonly onNewThread: () => void
  readonly onClose: () => void
}

export function ChatRailController({
  cwd,
  selectedId,
  onShowThreads,
  onNewThread,
  onClose
}: ChatRailControllerProps): React.JSX.Element {
  const { t } = useTranslation()
  const { agent } = useAgent()
  const [value, setValue] = useState('')
  const [prompt, setPrompt] = useState<string | null>(null)
  const [expandOverride, setExpandOverride] = useState<boolean | null>(null)

  const activity = useAgentActivityLog(agent, {
    calling: (tool) => t('rail.calling', { tool }),
    done: (tool) => t('rail.done', { tool }),
    runError: (message) => t('rail.runError', { message })
  })

  const working = activity.status === 'working'

  const submit = (): void => {
    const text = value.trim()
    if (text.length === 0 || activity.status === 'working') return
    setPrompt(text)
    setValue('')
    setExpandOverride(null)
    agent.addMessage({ id: crypto.randomUUID(), role: 'user', content: text })
    void agent.runAgent()
  }

  return (
    <ConversationRailView
      labels={{
        chats: t('threads.open'),
        newChat: t('rail.newChat'),
        collapse: t('rail.collapse'),
        newChatEmpty: t('rail.newChatEmpty'),
        composerPlaceholder: t('rail.composerPlaceholder'),
        send: t('rail.send'),
        toSend: t('rail.toSend'),
        stop: t('rail.stop')
      }}
      title={prompt ?? t('rail.newChat')}
      hasTurn={prompt !== null || selectedId !== null}
      working={working}
      value={value}
      onChange={setValue}
      onSubmit={submit}
      onStop={() => agent.abortRun()}
      onNewChat={() => {
        setValue('')
        setPrompt(null)
        setExpandOverride(null)
        onNewThread()
      }}
      onShowThreads={onShowThreads}
      onClose={onClose}
    >
      {selectedId !== null && <ConversationHistoryController cwd={cwd} threadId={selectedId} />}
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
          expanded={expandOverride ?? working}
          onToggleExpand={() => setExpandOverride(!(expandOverride ?? working))}
        />
      )}
    </ConversationRailView>
  )
}

export type { ChatRailControllerProps }
