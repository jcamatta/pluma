// App shell: first asks for a folder, then mounts the explorer + editor for the picked root. Driven
// through the real providers (QueryClient + RepositoriesProvider) over a faked window.api, so the IPC
// adapter and the pick flow exercise their real code paths against the fake wire. The shell mounts the
// conversation rail, which reads the threads repository, so the test supplies the same in-memory fake the
// rail's own tests use (the real ThreadsProvider lives in main.tsx, not App) — without it the rail throws
// and the shell never renders.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next'
import { FOLDER_PICK_CHANNEL, FOLDER_LIST_CHANNEL } from '../../../shared/ipc/ipc-contract/folder'
import { i18n } from '../i18n'
import { App } from '../App'
import { RepositoriesProvider } from '../explorer/RepositoriesProvider'
import { installFakeWindowApi } from '../explorer/__tests__/fake-window-api'
import { ThreadsContext } from '../threads/ThreadsContext'
import { createFakeThreadsRepository } from '../threads/__tests__/fake-threads-repository'

afterEach(() => vi.unstubAllGlobals())

const renderApp = (): void => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <RepositoriesProvider>
          <ThreadsContext.Provider value={createFakeThreadsRepository({})}>
            <App />
          </ThreadsContext.Provider>
        </RepositoriesProvider>
      </I18nextProvider>
    </QueryClientProvider>
  )
}

describe('App', () => {
  it('shows the open-folder affordance before a folder is picked', () => {
    installFakeWindowApi({})
    renderApp()
    expect(screen.getByText('Open Folder…')).toBeInTheDocument()
  })

  it('mounts the explorer and editor after a folder is picked', async () => {
    installFakeWindowApi({
      [FOLDER_PICK_CHANNEL]: () => ({ ok: true, value: '/workspace' }),
      [FOLDER_LIST_CHANNEL]: () => ({ ok: true, value: [{ name: 'a.md', type: 'file' }] })
    })
    renderApp()

    fireEvent.click(screen.getByText('Open Folder…'))

    await waitFor(() => {
      expect(screen.getByText('Files')).toBeInTheDocument()
    })
    expect(await screen.findByText('a.md')).toBeInTheDocument()
    await waitFor(() => {
      expect(document.querySelector('.ProseMirror')).not.toBeNull()
    })
  })

  it('mounts the editor top bar in the editor panel', async () => {
    installFakeWindowApi({
      [FOLDER_PICK_CHANNEL]: () => ({ ok: true, value: '/workspace' }),
      [FOLDER_LIST_CHANNEL]: () => ({ ok: true, value: [{ name: 'Act I.md', type: 'file' }] })
    })
    renderApp()

    fireEvent.click(screen.getByText('Open Folder…'))

    // No file selected yet: the bar shows the untitled fallback and exposes the settings trigger. The
    // basename-from-path derivation is covered by editor-file-name-logic and Editor.view tests.
    expect(await screen.findByText('Untitled')).toBeInTheDocument()
    expect(screen.getByLabelText('Settings')).toBeInTheDocument()
  })

  it('opens the settings modal from the top-bar settings button', async () => {
    installFakeWindowApi({
      [FOLDER_PICK_CHANNEL]: () => ({ ok: true, value: '/workspace' }),
      [FOLDER_LIST_CHANNEL]: () => ({ ok: true, value: [] })
    })
    renderApp()

    fireEvent.click(screen.getByText('Open Folder…'))

    fireEvent.click(await screen.findByLabelText('Settings'))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Appearance')).toBeInTheDocument()
  })
})
