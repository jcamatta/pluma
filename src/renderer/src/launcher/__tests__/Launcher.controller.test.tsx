// Controller test for the launcher: wires the real useFolderPick hook over a fake picker port and
// asserts that clicking Open Folder picks a folder and reports the chosen path up via onPicked. A
// cancelled/failed pick leaves onPicked uncalled.

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { i18n } from '../../i18n'
import { LauncherController } from '../Launcher.controller'
import { RepositoriesContext } from '../../explorer/RepositoriesContext'
import { createFakeFolderRepository } from '../../explorer/__tests__/fake-folder-repository'
import type { FakeRepository } from '../../explorer/__tests__/fake-folder-repository'

const renderController = (repo: FakeRepository, onPicked: (path: string) => void): void => {
  render(
    <I18nextProvider i18n={i18n}>
      <RepositoriesContext.Provider value={repo}>
        <LauncherController onPicked={onPicked} />
      </RepositoriesContext.Provider>
    </I18nextProvider>
  )
}

describe('Launcher controller', () => {
  it('reports the picked folder up on a successful pick', async () => {
    const repo = createFakeFolderRepository({})
    vi.spyOn(repo.picker, 'pick').mockResolvedValue({ ok: true, value: '/workspace' })
    const onPicked = vi.fn()
    renderController(repo, onPicked)

    fireEvent.click(screen.getByText('Open Folder…'))

    await waitFor(() => expect(onPicked).toHaveBeenCalledWith('/workspace'))
  })

  it('does not report when the pick is cancelled', async () => {
    const repo = createFakeFolderRepository({})
    const pick = vi.spyOn(repo.picker, 'pick')
    const onPicked = vi.fn()
    renderController(repo, onPicked)

    fireEvent.click(screen.getByText('Open Folder…'))

    await waitFor(() => expect(pick).toHaveBeenCalled())
    expect(onPicked).not.toHaveBeenCalled()
  })
})
