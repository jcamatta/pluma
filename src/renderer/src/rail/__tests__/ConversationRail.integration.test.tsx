// Integration of the rail switch with the real agent providers and the threads data layer: opening the
// threads list, selecting a thread switches back to the chat view and renders the loaded transcript.
// Renders through the real AgentToolsProvider + AgentProvider (over a stubbed window.api) so the actual
// ThreadControls binding is exercised — destructuring seedThread must not lose the Agent's `this`. The
// threads repository is the in-memory fake. Reproduces the select → resume → transcript path.

import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next'
import type { Message } from '@ag-ui/core'
import { i18n } from '../../i18n'
import { AgentProvider } from '../../agent/AgentProvider'
import { AgentToolsProvider } from '../../agent/AgentToolsProvider'
import { ThreadsContext } from '../../threads/ThreadsContext'
import { createFakeThreadsRepository } from '../../threads/__tests__/fake-threads-repository'
import { ConversationRailController } from '../ConversationRail.controller'

afterEach(() => vi.unstubAllGlobals())

const history: readonly Message[] = [
  { id: 'm1', role: 'user', content: 'Review my intro' },
  { id: 'm2', role: 'assistant', content: 'Here is a tighter draft.' }
]

function renderRail(): void {
  vi.stubGlobal('api', { invoke: vi.fn(), on: vi.fn(() => () => undefined) })
  const repos = createFakeThreadsRepository({
    threads: [{ id: 's1', title: 'First chat', updatedAt: 1 }],
    history
  })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { readonly children: ReactNode }): React.JSX.Element => (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <ThreadsContext.Provider value={repos}>
          <AgentToolsProvider>
            <AgentProvider cwd="/work">{children}</AgentProvider>
          </AgentToolsProvider>
        </ThreadsContext.Provider>
      </I18nextProvider>
    </QueryClientProvider>
  )
  render(<ConversationRailController cwd="/work" onClose={() => undefined} />, { wrapper })
}

describe('ConversationRailController thread selection', () => {
  it('selecting a thread returns to chat and shows its transcript', async () => {
    renderRail()

    fireEvent.click(screen.getByRole('button', { name: i18n.t('threads.open') }))
    fireEvent.click(await screen.findByTestId('thread-row:s1'))

    await waitFor(() => expect(screen.getByTestId('conversation-rail')).toBeInTheDocument())
    expect(await screen.findByTestId('thread-transcript')).toBeInTheDocument()
    expect(screen.getByText('Review my intro')).toBeInTheDocument()
  })
})
