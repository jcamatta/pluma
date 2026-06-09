// React state for the user's settings. Seeds from localStorage (loadSettings) and, on each change,
// persists + applies the choice (saveTheme writes the data-theme attribute) and mirrors it into local
// state so the controls re-render. The app shell owns one instance and hands it to the SettingsDialog.

import { useState } from 'react'
import { loadSettings, saveTheme, type Theme } from './settings'

export type UseSettings = {
  readonly theme: Theme
  readonly setTheme: (theme: Theme) => void
}

export function useSettings(): UseSettings {
  const [settings, setSettings] = useState(loadSettings)

  const setTheme = (theme: Theme): void => {
    saveTheme(theme)
    setSettings((current) => ({ ...current, theme }))
  }

  return { ...settings, setTheme }
}
