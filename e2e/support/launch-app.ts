// Launches the real built Electron app (out/main/index.js) and returns the running app handle plus its
// first window. Specs drive this exactly as a user would: real main process, real preload, real
// window.api/IPC, real filesystem use cases, real OS watcher. Nothing is mocked here. The only thing a
// spec ever overrides is the native OS folder dialog (see stub-folder-picker), which a human would
// otherwise click and Playwright cannot.

import { join } from 'node:path'
import { _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'

const MAIN_ENTRY = join(__dirname, '..', '..', 'out', 'main', 'index.js')

type LaunchedApp = {
  readonly app: ElectronApplication
  readonly window: Page
}

// Electron must launch as a real desktop app, not as Node. Some shells/IDEs export
// ELECTRON_RUN_AS_NODE=1, which makes electron.exe run the entry as a plain Node script (no
// electron.app, and Chromium flags like --remote-debugging-port are rejected). Build the launch env
// from process.env with that key dropped (and undefined values filtered out, since launch wants only
// string values) so the launched app is the real GUI process regardless of the ambient environment.
const guiEnv = (): Record<string, string> => {
  const entries = Object.entries(process.env).filter(
    (entry): entry is [string, string] =>
      entry[0] !== 'ELECTRON_RUN_AS_NODE' && entry[1] !== undefined
  )
  return Object.fromEntries(entries)
}

const launchApp = async (): Promise<LaunchedApp> => {
  const app = await electron.launch({ args: [MAIN_ENTRY], env: guiEnv() })
  const window = await app.firstWindow()
  await window.waitForLoadState('domcontentloaded')
  return { app, window }
}

export { launchApp, type LaunchedApp }
