// Owns the rail's thread-selection state: which panel is showing (chat vs the threads list) and which
// thread is active, plus the agent seeding that resumes a selected thread or starts a fresh one. Reads
// the thread controls directly from context (no agent subscription needed here). Selecting seeds the
// agent so the next run resumes that SDK session; the loaded transcript is rendered separately from the
// thread-history query. Keeps this logic out of the rail controller, which is at its statement budget.

import { useContext, useState } from 'react'
import { ThreadControlsContext } from '../agent/ThreadControlsContext'

type RailView = 'chat' | 'threads'

interface ThreadSession {
  readonly view: RailView
  readonly selectedId: string | null
  readonly showThreads: () => void
  readonly showChat: () => void
  readonly select: (id: string) => void
  readonly startNew: () => void
}

function useThreadSession(): ThreadSession {
  const { seedThread, newThread } = useContext(ThreadControlsContext)
  const [view, setView] = useState<RailView>('chat')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const select = (id: string): void => {
    setSelectedId(id)
    seedThread(id, [])
    setView('chat')
  }

  const startNew = (): void => {
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
