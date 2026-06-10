// Wires the conversation rail: resolves i18n labels, owns the composer's local value, and renders the
// pure ConversationRailView. Closing the rail is lifted to the app shell (like the explorer). Running a
// turn is not wired yet — onSend surfaces the submitted text so the shell/agent layer (F4) can start a
// run; the controller clears the composer on submit. Until a turn renders (F3/F4) the rail shows its
// empty state.

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ConversationRailView } from './ConversationRail.view'

interface ConversationRailControllerProps {
  readonly onClose: () => void
  // Called with the composed message when the user sends. Wiring this to a run is F4.
  readonly onSend: (text: string) => void
}

export function ConversationRailController({
  onClose,
  onSend
}: ConversationRailControllerProps): React.JSX.Element {
  const { t } = useTranslation()
  const [value, setValue] = useState('')

  const submit = (): void => {
    const text = value.trim()
    if (text.length === 0) return
    onSend(text)
    setValue('')
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
        toSend: t('rail.toSend')
      }}
      title={t('rail.newChat')}
      hasTurn={false}
      value={value}
      onChange={setValue}
      onSubmit={submit}
      onNewChat={() => setValue('')}
      onClose={onClose}
    />
  )
}

export type { ConversationRailControllerProps }
