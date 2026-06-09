// useRootFolder against a fake window.api: pick() opens the folder picker over IPC and adopts the chosen
// path on ok: true, while a cancelled pick (ok: false) leaves the root unchanged. installFakeWindowApi is
// the single seam — no real Electron, no native dialog.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useRootFolder } from '../useRootFolder'
import { FOLDER_PICK_CHANNEL } from '../../../../shared/ipc/ipc-contract/folder'
import { installFakeWindowApi } from './fake-window-api'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useRootFolder', () => {
  it('starts with no root', () => {
    installFakeWindowApi({})
    const { result } = renderHook(() => useRootFolder())

    expect(result.current.root).toBeNull()
  })

  it('adopts the picked folder on a successful pick', async () => {
    installFakeWindowApi({
      [FOLDER_PICK_CHANNEL]: () => ({ ok: true, value: '/home/me/novel' })
    })
    const { result } = renderHook(() => useRootFolder())

    await act(async () => {
      await result.current.pick()
    })

    expect(result.current.root).toBe('/home/me/novel')
  })

  it('keeps the root null when the pick is cancelled', async () => {
    installFakeWindowApi({
      [FOLDER_PICK_CHANNEL]: () => ({ ok: false, error: { _tag: 'FolderSelectionCancelled' } })
    })
    const { result } = renderHook(() => useRootFolder())

    await act(async () => {
      await result.current.pick()
    })

    expect(result.current.root).toBeNull()
  })
})
