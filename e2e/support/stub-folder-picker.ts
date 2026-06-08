// Overrides Electron's native folder dialog in the running main process so a spec can "pick" a real
// directory without a human clicking the OS file chooser (which Playwright cannot drive). Everything
// downstream is real: the override returns an actual on-disk path, so the real FolderPicker port ->
// list-folder use case -> OS watcher all run against it. This is the one and only sanctioned stub in
// the e2e suite; it replaces a human gesture, not application behavior.

import type { ElectronApplication } from '@playwright/test'

const stubFolderPicker = async (app: ElectronApplication, folder: string): Promise<void> => {
  await app.evaluate((electron, picked) => {
    electron.dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [picked] })
  }, folder)
}

export { stubFolderPicker }
