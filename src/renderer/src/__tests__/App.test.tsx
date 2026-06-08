// App shell: first asks for a folder, then mounts the explorer + editor for the picked root. Driven
// through the real providers (QueryClient + RepositoriesProvider) over a faked window.api, so the IPC
// adapter and the pick flow exercise their real code paths against the fake wire.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next'
import { FOLDER_PICK_CHANNEL, FOLDER_LIST_CHANNEL } from '../../../shared/ipc/ipc-contract/folder'
import { i18n } from '../i18n'
import { App } from '../App'
import { RepositoriesProvider } from '../explorer/RepositoriesProvider'
import { installFakeWindowApi } from '../explorer/__tests__/fake-window-api'

afterEach(() => vi.unstubAllGlobals())

const renderApp = (): void => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <RepositoriesProvider>
          <App />
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
})
