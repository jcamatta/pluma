// Owns the rail's thread-selection state: which panel is showing (chat vs the threads list) and which
// thread is active, plus the agent seeding that resumes a selected thread. Selecting a thread loads its
// history (useThreadHistory) and, once, seeds the agent with it — setting the resume session id and the
// transcript the chat half renders from agent.messages. The backend only re-sends new user turns, so the
// seeded history is not double-counted on the next run. Starting a new thread clears the agent. Keeps this
// logic out of the rail controller.

import { useContext, useEffect, useRef, useState } from 'react'
import { ThreadControlsContext } from '../agent/ThreadControlsContext'
import { useThreadHistory } from '../threads/useThreadHistory'
import { useThreadContext } from '../threads/useThreadContext'
import { useThreads } from '../threads/useThreads'

type RailView = 'chat' | 'threads'

interface ThreadSession {
  readonly view: RailView
  readonly selectedId: string | null
  readonly selectedTitle: string | null
  readonly showThreads: () => void
  readonly showChat: () => void
  readonly select: (id: string) => void
  readonly startNew: () => void
}

function useThreadSession(cwd: string): ThreadSession {
  const { seedThread, newThread, currentThreadId, seedContext } = useContext(ThreadControlsContext)
  const [view, setView] = useState<RailView>('chat')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const history = useThreadHistory(cwd, selectedId)
  const context = useThreadContext(cwd, selectedId)
  const threads = useThreads(cwd)
  const seededFor = useRef<string | null>(null)
  // The thread the chat header names: the user's selection, else the session the live chat adopted on its
  // first run. Its stored title (renameable) is resolved from the threads list so a rename shows here too.
  const selectedTitle =
    (threads.data?.ok ? threads.data.value : []).find(
      (summary) => summary.id === (selectedId ?? currentThreadId() ?? null)
    )?.title ?? null

  // Seed the agent from the selected thread once history loads, and seed the context meter from its
  // stored usage so it shows on resume before any run. The two reads resolve independently; each block
  // fires when its data is ready. The live run path overwrites the meter via STATE_SNAPSHOT; starting a
  // new thread clears it.
  useEffect(() => {
    const loaded = history.data
    if (selectedId !== null && loaded?.ok && seededFor.current !== selectedId) {
      seededFor.current = selectedId
      seedThread(selectedId, loaded.value)
    }
    if (selectedId !== null && context.data?.ok) seedContext(context.data.value)
  }, [selectedId, history.data, context.data, seedThread, seedContext])

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
    selectedTitle,
    showThreads: () => setView('threads'),
    showChat: () => setView('chat'),
    select,
    startNew
  }
}

export { useThreadSession }
export type { ThreadSession, RailView }
