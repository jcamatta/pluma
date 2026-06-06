// Tests for the pick-folder IPC handler. Mocks Electron's dialog and verifies the handler serializes
// the use-case outcome into a plain Result: ok:true with the path on success, ok:false with a tagged
// error on cancellation and on dialog failure.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const showOpenDialog = vi.fn()
vi.mock('electron', () => ({ dialog: { showOpenDialog } }))

const handle = (): Promise<{ ok: boolean }> =>
  import('../pick-folder-handler').then(({ handlePickFolder }) => handlePickFolder())

describe('handlePickFolder', () => {
  beforeEach(() => {
    showOpenDialog.mockReset()
  })

  it('returns ok:true with the chosen path', async () => {
    showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['/notes'] })
    const result = await handle()

    expect(result).toStrictEqual({ ok: true, value: '/notes' })
  })

  it('returns ok:false with FolderSelectionCancelled when dismissed', async () => {
    showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] })
    const result = await handle()

    expect(result).toStrictEqual({ ok: false, error: { _tag: 'FolderSelectionCancelled' } })
  })

  it('returns ok:false with FolderSelectionFailed when the dialog throws', async () => {
    showOpenDialog.mockRejectedValue(new Error('boom'))
    const result = await handle()

    expect(result).toStrictEqual({ ok: false, error: { _tag: 'FolderSelectionFailed' } })
  })
})
