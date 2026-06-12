// ThreadsPanelController against an in-memory fake repository: it lists the workspace's threads, shows
// the localized untitled fallback for a blank title, and bubbles onSelect with the row id when a thread
// is clicked. The fake is the single seam — no window.api, no Electron.

import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next'
import type { ThreadSummary } from '../../../../shared/ipc/ipc-contract/agent'
import { i18n } from '../../i18n'
import { ThreadsContext } from '../ThreadsContext'
import type { ThreadsRepositories } from '../ThreadsContext'
import { ThreadsPanelController } from '../ThreadsPanel.controller'
import { createFakeThreadsRepository } from './fake-threads-repository'

function renderPanel(
  repos: ThreadsRepositories,
  onSelect: ReturnType<typeof vi.fn> = vi.fn()
): { readonly onSelect: ReturnType<typeof vi.fn> } {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { readonly children: ReactNode }): React.JSX.Element => (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <ThreadsContext.Provider value={repos}>{children}</ThreadsContext.Provider>
      </I18nextProvider>
    </QueryClientProvider>
  )
  render(
    <ThreadsPanelController
      cwd="/work"
      activeId={null}
      onSelect={onSelect}
      onNewThread={vi.fn()}
      onBack={vi.fn()}
    />,
    { wrapper }
  )
  return { onSelect }
}

const threads: readonly ThreadSummary[] = [
  { id: 's1', title: 'Draft review', updatedAt: 2 },
  { id: 's2', title: '', updatedAt: 1 }
]

describe('ThreadsPanelController', () => {
  it('lists the workspace threads and falls back to a localized untitled label', async () => {
    renderPanel(createFakeThreadsRepository({ threads }))
    expect(await screen.findByText('Draft review')).toBeInTheDocument()
    expect(screen.getByText(i18n.t('threads.untitled'))).toBeInTheDocument()
  })

  it('bubbles onSelect with the row id when a thread is clicked', async () => {
    const { onSelect } = renderPanel(createFakeThreadsRepository({ threads }))
    fireEvent.click(await screen.findByTestId('thread-row:s1'))
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith('s1'))
  })
})
