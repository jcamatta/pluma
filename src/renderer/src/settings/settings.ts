// The theme setting and how it is persisted and applied. The app's CSS (App.css) already reads a
// `data-theme` attribute on the document root — "light"/"dark" override the palette, and removing the
// attribute ("system") lets the prefers-color-scheme media query win. This module is the small bridge
// between the user's choice (stored in localStorage so it survives reloads) and that attribute. Kept
// framework-free so it can run at startup (initSettings) before React mounts and from the hook alike.

type Theme = 'light' | 'dark' | 'system'

type Settings = {
  readonly theme: Theme
}

const THEME_KEY = 'pluma.theme'

const THEMES: ReadonlySet<string> = new Set(['light', 'dark', 'system'])

function isTheme(value: string | null): value is Theme {
  return value !== null && THEMES.has(value)
}

function loadSettings(): Settings {
  const stored = localStorage.getItem(THEME_KEY)
  return { theme: isTheme(stored) ? stored : 'system' }
}

function applyTheme(theme: Theme): void {
  const root = document.documentElement
  // "system" removes the override so the prefers-color-scheme media query wins.
  if (theme === 'system') {
    root.removeAttribute('data-theme')
  } else {
    root.setAttribute('data-theme', theme)
  }
}

function saveTheme(theme: Theme): void {
  localStorage.setItem(THEME_KEY, theme)
  applyTheme(theme)
}

// Called once at app startup to apply the stored theme before the first paint.
function initSettings(): Settings {
  const settings = loadSettings()
  applyTheme(settings.theme)
  return settings
}

export { applyTheme, initSettings, isTheme, loadSettings, saveTheme }
export type { Settings, Theme }
