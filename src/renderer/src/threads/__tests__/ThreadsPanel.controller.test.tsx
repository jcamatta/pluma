// ThreadsPanelController against an in-memory fake repository: it lists the workspace's threads, shows
// the localized untitled fallback for a blank title, bubbles onSelect with the row id, and drives the
// rename/delete commands through the writer port (deleting the active thread bubbles onNewThread). The
// fake is the single seam — no window.api, no Electron.

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

interface Handlers {
  readonly activeId?: string | null
  readonly onSelect?: ReturnType<typeof vi.fn>
  readonly onNewThread?: ReturnType<typeof vi.fn>
}

function renderPanel(repos: ThreadsRepositories, handlers: Handlers = {}): void {
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
      activeId={handlers.activeId ?? null}
      onSelect={handlers.onSelect ?? vi.fn()}
      onNewThread={handlers.onNewThread ?? vi.fn()}
      onBack={vi.fn()}
    />,
    { wrapper }
  )
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
    const onSelect = vi.fn()
    renderPanel(createFakeThreadsRepository({ threads }), { onSelect })
    fireEvent.click(await screen.findByTestId('thread-row:s1'))
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith('s1'))
  })

  it('renames a thread through the writer port', async () => {
    const repos = createFakeThreadsRepository({ threads })
    const renameSpy = vi.spyOn(repos.writer, 'renameThread')
    renderPanel(repos)

    await screen.findByText('Draft review')
    fireEvent.click(screen.getAllByRole('button', { name: i18n.t('threads.rename') })[0])
    const field = screen.getByDisplayValue('Draft review')
    fireEvent.change(field, { target: { value: 'Renamed' } })
    fireEvent.keyDown(field, { key: 'Enter' })

    await waitFor(() =>
      expect(renameSpy).toHaveBeenCalledWith({ cwd: '/work', id: 's1', title: 'Renamed' })
    )
  })

  it('deletes the active thread on confirm and bubbles onNewThread', async () => {
    const repos = createFakeThreadsRepository({ threads })
    const deleteSpy = vi.spyOn(repos.writer, 'deleteThread')
    const onNewThread = vi.fn()
    renderPanel(repos, { activeId: 's1', onNewThread })

    await screen.findByText('Draft review')
    fireEvent.click(screen.getAllByRole('button', { name: i18n.t('threads.delete') })[0])
    fireEvent.click(await screen.findByRole('button', { name: i18n.t('threads.deleteConfirm') }))

    await waitFor(() => expect(deleteSpy).toHaveBeenCalledWith('/work', 's1'))
    expect(onNewThread).toHaveBeenCalledTimes(1)
  })
})
