// Registers all IPC endpoints on the main process. Each ipcMain.handle channel calls a handler that
// runs a use case and returns a plain Result. Called once after the app is ready.

import { ipcMain } from 'electron'
import { handleCreateFile } from './file/create-file-handler'

export const registerIpc = (): void => {
  ipcMain.handle('file:create', (_event, path: string) => handleCreateFile(path))
}
