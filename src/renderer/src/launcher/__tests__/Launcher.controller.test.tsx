// Controller test for the launcher: wires the real useFolderPick hook over a faked window.api and
// asserts that clicking Open Folder triggers folder:pick and reports the chosen path up via onPicked. A
// cancelled/failed pick leaves onPicked uncalled.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { FOLDER_PICK_CHANNEL } from '../../../../shared/ipc/ipc-contract/folder'
import { i18n } from '../../i18n'
import { LauncherController } from '../Launcher.controller'
import { installFakeWindowApi } from '../../explorer/__tests__/fake-window-api'

afterEach(() => vi.unstubAllGlobals())

const renderController = (onPicked: (path: string) => void): void => {
  render(
    <I18nextProvider i18n={i18n}>
      <LauncherController onPicked={onPicked} />
    </I18nextProvider>
  )
}

describe('Launcher controller', () => {
  it('reports the picked folder up on a successful pick', async () => {
    installFakeWindowApi({ [FOLDER_PICK_CHANNEL]: () => ({ ok: true, value: '/workspace' }) })
    const onPicked = vi.fn()
    renderController(onPicked)

    fireEvent.click(screen.getByText('Open Folder…'))

    await waitFor(() => expect(onPicked).toHaveBeenCalledWith('/workspace'))
  })

  it('does not report when the pick is cancelled', async () => {
    const api = installFakeWindowApi({
      [FOLDER_PICK_CHANNEL]: () => ({ ok: false, error: { _tag: 'FolderSelectionCancelled' } })
    })
    const onPicked = vi.fn()
    renderController(onPicked)

    fireEvent.click(screen.getByText('Open Folder…'))

    await waitFor(() =>
      expect(api.calls()).toContainEqual({ channel: FOLDER_PICK_CHANNEL, input: undefined })
    )
    expect(onPicked).not.toHaveBeenCalled()
  })
})
