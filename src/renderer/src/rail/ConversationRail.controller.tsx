// The rail's top-level switch: chooses between the chat half (ChatRail) and the threads list
// (ThreadsPanel), driven by useThreadSession. Showing the list swaps in the panel; selecting a thread
// resumes its session (seeding the agent) and returns to chat, where the chat half remounts fresh;
// starting a new thread does the same with no active thread. Closing the rail is lifted to the app shell.

import { ThreadsPanelController } from '../threads/ThreadsPanel.controller'
import { ChatRailController } from './ChatRail.controller'
import { useThreadSession } from './useThreadSession'

interface ConversationRailControllerProps {
  readonly cwd: string
  readonly onClose: () => void
}

export function ConversationRailController({
  cwd,
  onClose
}: ConversationRailControllerProps): React.JSX.Element {
  const session = useThreadSession()

  if (session.view === 'threads') {
    return (
      <ThreadsPanelController
        cwd={cwd}
        activeId={session.selectedId}
        onSelect={session.select}
        onNewThread={session.startNew}
        onBack={session.showChat}
      />
    )
  }

  return (
    <ChatRailController
      onShowThreads={session.showThreads}
      onNewThread={session.startNew}
      onClose={onClose}
    />
  )
}

export type { ConversationRailControllerProps }
