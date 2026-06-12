// App shell: first asks for a folder, then mounts the explorer + editor for the picked root. Driven
// through the real providers (QueryClient + RepositoriesProvider) over a faked window.api, so the IPC
// adapter and the pick flow exercise their real code paths against the fake wire.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next'
import { FOLDER_PICK_CHANNEL, FOLDER_LIST_CHANNEL } from '../../../shared/ipc/ipc-contract/folder'
import { FILE_READ_CHANNEL } from '../../../shared/ipc/ipc-contract/file'
import { i18n } from '../i18n'
import { App } from '../App'
import { RepositoriesProvider } from '../explorer/RepositoriesProvider'
import { ThreadsProvider } from '../threads/ThreadsProvider'
import { installFakeWindowApi } from '../explorer/__tests__/fake-window-api'

// Unmount the tree before unstubbing window.api: an auto-opened file's autosave flushes on unmount, so
// the fake must still be in place when that cleanup runs.
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const renderApp = (): void => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <RepositoriesProvider>
          <ThreadsProvider>
            <App />
          </ThreadsProvider>
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

  it('mounts the explorer and auto-opens the first file after a folder is picked', async () => {
    installFakeWindowApi({
      [FOLDER_PICK_CHANNEL]: () => ({ ok: true, value: '/workspace' }),
      [FOLDER_LIST_CHANNEL]: () => ({ ok: true, value: [{ name: 'a.md', type: 'file' }] }),
      [FILE_READ_CHANNEL]: () => ({ ok: true, value: '# Alpha' })
    })
    renderApp()

    fireEvent.click(screen.getByText('Open Folder…'))

    await waitFor(() => {
      expect(screen.getByText('Files')).toBeInTheDocument()
    })
    expect(await screen.findByText('a.md')).toBeInTheDocument()
    // The first markdown file opens on its own — its editor surface mounts without a manual click.
    await waitFor(() => {
      expect(document.querySelector('.ProseMirror')).not.toBeNull()
    })
  })

  it('shows the open file’s name and the settings trigger in the editor top bar', async () => {
    installFakeWindowApi({
      [FOLDER_PICK_CHANNEL]: () => ({ ok: true, value: '/workspace' }),
      [FOLDER_LIST_CHANNEL]: () => ({ ok: true, value: [{ name: 'Act I.md', type: 'file' }] }),
      [FILE_READ_CHANNEL]: () => ({ ok: true, value: '# Act I' })
    })
    renderApp()

    fireEvent.click(screen.getByText('Open Folder…'))

    // The auto-opened file's basename (without .md) shows in the top bar, alongside the settings trigger.
    expect(await screen.findByText('Act I')).toBeInTheDocument()
    expect(screen.getByLabelText('Settings')).toBeInTheDocument()
  })

  it('opens the settings modal from the empty-state settings button', async () => {
    installFakeWindowApi({
      [FOLDER_PICK_CHANNEL]: () => ({ ok: true, value: '/workspace' }),
      [FOLDER_LIST_CHANNEL]: () => ({ ok: true, value: [] })
    })
    renderApp()

    fireEvent.click(screen.getByText('Open Folder…'))

    // No markdown file: the empty state shows, and its settings trigger still opens the modal.
    expect(await screen.findByText('No file open')).toBeInTheDocument()
    fireEvent.click(await screen.findByLabelText('Settings'))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Appearance')).toBeInTheDocument()
  })
})
