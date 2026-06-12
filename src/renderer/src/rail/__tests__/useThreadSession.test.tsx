// useThreadSession against a spy ThreadControls: selecting a thread seeds the agent with that id and
// records it as active, starting a new thread clears the selection and resets the agent, and the view
// toggles between chat and the threads list. No agent subscription, no IPC.

import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { ThreadControlsContext } from '../../agent/ThreadControlsContext'
import type { ThreadControls } from '../../agent/ThreadControlsContext'
import { useThreadSession } from '../useThreadSession'

type ThreadSession = ReturnType<typeof useThreadSession>

function renderSession(
  controls: ThreadControls
): ReturnType<typeof renderHook<ThreadSession, void>> {
  const wrapper = ({ children }: { readonly children: ReactNode }): React.JSX.Element => (
    <ThreadControlsContext.Provider value={controls}>{children}</ThreadControlsContext.Provider>
  )
  return renderHook(() => useThreadSession(), { wrapper })
}

describe('useThreadSession', () => {
  it('seeds the agent and tracks the active thread on select', () => {
    const controls: ThreadControls = { seedThread: vi.fn(), newThread: vi.fn() }
    const { result } = renderSession(controls)

    act(() => result.current.showThreads())
    expect(result.current.view).toBe('threads')

    act(() => result.current.select('s1'))
    expect(controls.seedThread).toHaveBeenCalledWith('s1', [])
    expect(result.current.selectedId).toBe('s1')
    expect(result.current.view).toBe('chat')
  })

  it('clears the selection and resets the agent on a new thread', () => {
    const controls: ThreadControls = { seedThread: vi.fn(), newThread: vi.fn() }
    const { result } = renderSession(controls)

    act(() => result.current.select('s1'))
    act(() => result.current.startNew())
    expect(controls.newThread).toHaveBeenCalledTimes(1)
    expect(result.current.selectedId).toBeNull()
  })
})
