// Owns the app shell's side-panel visibility (explorer, rail) and the settings dialog, plus stable
// open/close handlers. Lifting this out of App keeps App focused on layout and, because the handlers
// keep a constant identity, lets the memoized columns skip re-rendering when an unrelated panel toggles.

import { useCallback, useState } from 'react'

type Panels = {
  readonly explorerOpen: boolean
  readonly railOpen: boolean
  readonly settingsOpen: boolean
  readonly openExplorer: () => void
  readonly closeExplorer: () => void
  readonly openRail: () => void
  readonly closeRail: () => void
  readonly openSettings: () => void
  readonly setSettingsOpen: (open: boolean) => void
}

function usePanels(): Panels {
  const [explorerOpen, setExplorerOpen] = useState(true)
  const [railOpen, setRailOpen] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const openExplorer = useCallback(() => setExplorerOpen(true), [])
  const closeExplorer = useCallback(() => setExplorerOpen(false), [])
  const openRail = useCallback(() => setRailOpen(true), [])
  const closeRail = useCallback(() => setRailOpen(false), [])
  const openSettings = useCallback(() => setSettingsOpen(true), [])
  return {
    explorerOpen,
    railOpen,
    settingsOpen,
    openExplorer,
    closeExplorer,
    openRail,
    closeRail,
    openSettings,
    setSettingsOpen
  }
}

export { usePanels }
export type { Panels }
