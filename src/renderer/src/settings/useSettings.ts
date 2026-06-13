// React state for the user's settings. Seeds from localStorage (loadSettings) and, on each change,
// persists + applies the choice (saveTheme writes the data-theme attribute) and mirrors it into local
// state so the controls re-render. The app shell owns one instance and hands it to the SettingsDialog.

import { useState } from 'react'
import { i18n } from '../i18n'
import { loadSettings, saveLanguage, saveTheme, type Language, type Theme } from './settings'

export type UseSettings = {
  readonly theme: Theme
  readonly setTheme: (theme: Theme) => void
  readonly language: Language
  readonly setLanguage: (language: Language) => void
}

export function useSettings(): UseSettings {
  const [settings, setSettings] = useState(loadSettings)

  const setTheme = (theme: Theme): void => {
    saveTheme(theme)
    setSettings((current) => ({ ...current, theme }))
  }

  const setLanguage = (language: Language): void => {
    saveLanguage(language)
    void i18n.changeLanguage(language)
    setSettings((current) => ({ ...current, language }))
  }

  return { ...settings, setTheme, setLanguage }
}
