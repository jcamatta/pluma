// Tests for the Electron-backed FolderPicker adapter. Mocks dialog.showOpenDialog and verifies it asks
// for a directory-only picker and maps each outcome to the domain's typed result: a chosen folder ->
// its path, a dismissed dialog -> FolderSelectionCancelled, a thrown error -> FolderSelectionFailed.

import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const showOpenDialog = vi.fn()
vi.mock('electron', () => ({ dialog: { showOpenDialog } }))

const run = (): Promise<Exit.Exit<string, { readonly _tag: string }>> =>
  import('../electron-folder-picker').then(({ ElectronFolderPickerLive }) =>
    import('../../../application/folder/port/folder-picker.port').then(({ FolderPicker }) =>
      Effect.runPromiseExit(
        Effect.flatMap(FolderPicker, (picker) => picker.pickFolder()).pipe(
          Effect.provide(ElectronFolderPickerLive)
        )
      )
    )
  )

describe('ElectronFolderPickerLive', () => {
  beforeEach(() => {
    showOpenDialog.mockReset()
  })

  it('returns the chosen folder path', async () => {
    showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['/notes'] })
    const exit = await run()

    expect(exit).toStrictEqual(Exit.succeed('/notes'))
    expect(showOpenDialog).toHaveBeenCalledWith(
      expect.objectContaining({ properties: ['openDirectory', 'createDirectory'] })
    )
  })

  it('fails with FolderSelectionCancelled when the user dismisses the dialog', async () => {
    showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] })
    const exit = await run()

    expect(exit).toStrictEqual(
      Exit.fail(expect.objectContaining({ _tag: 'FolderSelectionCancelled' }))
    )
  })

  it('fails with FolderSelectionCancelled when no folder comes back', async () => {
    showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [] })
    const exit = await run()

    expect(exit).toStrictEqual(
      Exit.fail(expect.objectContaining({ _tag: 'FolderSelectionCancelled' }))
    )
  })

  it('fails with FolderSelectionFailed when the dialog throws', async () => {
    showOpenDialog.mockRejectedValue(new Error('boom'))
    const exit = await run()

    expect(exit).toStrictEqual(
      Exit.fail(expect.objectContaining({ _tag: 'FolderSelectionFailed' }))
    )
  })
})
