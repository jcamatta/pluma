// ConversationHistoryController against an in-memory fake repository: it loads the selected thread's
// history and renders its transcript, and shows the error state when the read fails. The fake is the
// single seam — no window.api, no Electron.

import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next'
import type { Message } from '@ag-ui/core'
import { i18n } from '../../i18n'
import { ThreadsContext } from '../../threads/ThreadsContext'
import type { ThreadsRepositories } from '../../threads/ThreadsContext'
import { createFakeThreadsRepository } from '../../threads/__tests__/fake-threads-repository'
import { ConversationHistoryController } from '../ConversationHistory.controller'

function renderHistory(repos: ThreadsRepositories): void {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { readonly children: ReactNode }): React.JSX.Element => (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <ThreadsContext.Provider value={repos}>{children}</ThreadsContext.Provider>
      </I18nextProvider>
    </QueryClientProvider>
  )
  render(<ConversationHistoryController cwd="/work" threadId="s1" />, { wrapper })
}

const history: readonly Message[] = [
  { id: 'm1', role: 'user', content: 'Review my intro' },
  { id: 'm2', role: 'assistant', content: 'Here is a tighter draft.' }
]

describe('ConversationHistoryController', () => {
  it('renders the loaded transcript', async () => {
    renderHistory(createFakeThreadsRepository({ history }))
    expect(await screen.findByText('Review my intro')).toBeInTheDocument()
    expect(screen.getByText('Here is a tighter draft.')).toBeInTheDocument()
  })

  it('shows the error state when the read fails', async () => {
    const repos = createFakeThreadsRepository({})
    vi.spyOn(repos.reader, 'getThreadHistory').mockResolvedValue({
      ok: false,
      error: { _tag: 'ThreadReadFailed' }
    })
    renderHistory(repos)
    await waitFor(() =>
      expect(screen.getByText(i18n.t('threads.historyError'))).toBeInTheDocument()
    )
  })
})
