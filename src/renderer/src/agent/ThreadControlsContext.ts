// Context carrying the thread-lifecycle controls (seed a selected thread / start a fresh one) for the
// subtree. These are Agent-specific operations that AgentContext (typed as the generic AbstractAgent so
// tests inject fakes) cannot express, so they travel on their own context. The provider supplies the
// concrete Agent, which implements ThreadControls; the default is a no-op so a tree mounting only
// AgentContext (e.g. fake-agent tests) still renders. useAgent reads it and re-exports the controls.

import { createContext } from 'react'
import type { Message } from '@ag-ui/core'

interface ThreadControls {
  readonly seedThread: (id: string, messages: readonly Message[]) => void
  readonly newThread: () => void
}

const ThreadControlsContext = createContext<ThreadControls>({
  seedThread: () => undefined,
  newThread: () => undefined
})

export { ThreadControlsContext }
export type { ThreadControls }
