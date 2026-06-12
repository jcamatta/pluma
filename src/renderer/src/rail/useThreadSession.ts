// Owns the rail's thread-selection state: which panel is showing (chat vs the threads list) and which
// thread is active, plus the agent seeding that resumes a selected thread. Selecting a thread loads its
// history (useThreadHistory) and, once, seeds the agent with it — setting the resume session id and the
// transcript the chat half renders from agent.messages. The backend only re-sends new user turns, so the
// seeded history is not double-counted on the next run. Starting a new thread clears the agent. Keeps this
// logic out of the rail controller.

import { useContext, useEffect, useRef, useState } from 'react'
import { ThreadControlsContext } from '../agent/ThreadControlsContext'
import { useThreadHistory } from '../threads/useThreadHistory'

type RailView = 'chat' | 'threads'

interface ThreadSession {
  readonly view: RailView
  readonly selectedId: string | null
  readonly showThreads: () => void
  readonly showChat: () => void
  readonly select: (id: string) => void
  readonly startNew: () => void
}

function useThreadSession(cwd: string): ThreadSession {
  const { seedThread, newThread } = useContext(ThreadControlsContext)
  const [view, setView] = useState<RailView>('chat')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const history = useThreadHistory(cwd, selectedId)
  const seededFor = useRef<string | null>(null)

  useEffect(() => {
    const data = history.data
    if (selectedId !== null && data?.ok && seededFor.current !== selectedId) {
      seededFor.current = selectedId
      seedThread(selectedId, data.value)
    }
  }, [selectedId, history.data, seedThread])

  const select = (id: string): void => {
    setSelectedId(id)
    setView('chat')
  }

  const startNew = (): void => {
    seededFor.current = null
    setSelectedId(null)
    newThread()
    setView('chat')
  }

  return {
    view,
    selectedId,
    showThreads: () => setView('threads'),
    showChat: () => setView('chat'),
    select,
    startNew
  }
}

export { useThreadSession }
export type { ThreadSession, RailView }
