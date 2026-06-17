// usePanels owns side-panel + settings visibility for the app shell. Both panels start open and
// settings closed; the open/close handlers flip exactly their own flag; and — the invariant the
// memoized columns rely on — every handler keeps a constant identity across re-renders.

import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { usePanels } from '../usePanels'

describe('usePanels', () => {
  it('starts with both panels open and settings closed', () => {
    const { result } = renderHook(usePanels)
    expect(result.current.explorerOpen).toBe(true)
    expect(result.current.railOpen).toBe(true)
    expect(result.current.settingsOpen).toBe(false)
  })

  it('toggles each panel independently', () => {
    const { result } = renderHook(usePanels)

    act(() => result.current.closeExplorer())
    expect(result.current.explorerOpen).toBe(false)
    expect(result.current.railOpen).toBe(true)

    act(() => result.current.closeRail())
    expect(result.current.railOpen).toBe(false)

    act(() => result.current.openExplorer())
    expect(result.current.explorerOpen).toBe(true)
  })

  it('opens and sets the settings dialog', () => {
    const { result } = renderHook(usePanels)

    act(() => result.current.openSettings())
    expect(result.current.settingsOpen).toBe(true)

    act(() => result.current.setSettingsOpen(false))
    expect(result.current.settingsOpen).toBe(false)
  })

  it('keeps stable handler identities across re-renders', () => {
    const { result, rerender } = renderHook(usePanels)
    const before = result.current

    act(() => result.current.closeExplorer())
    rerender()

    expect(result.current.openExplorer).toBe(before.openExplorer)
    expect(result.current.closeExplorer).toBe(before.closeExplorer)
    expect(result.current.openRail).toBe(before.openRail)
    expect(result.current.closeRail).toBe(before.closeRail)
    expect(result.current.openSettings).toBe(before.openSettings)
    expect(result.current.setSettingsOpen).toBe(before.setSettingsOpen)
  })
})
