// Registers all IPC endpoints on the main process. Each ipcMain.handle channel calls a handler that
// runs a use case and returns a plain Result. Called once after the app is ready.

import { ipcMain } from 'electron'
import { handleCreateFile } from './file/create-file-handler'
import { handleDeleteFile } from './file/delete-file-handler'
import { handleCreateFolder } from './folder/create-folder-handler'
import { handleDeleteFolder } from './folder/delete-folder-handler'
import { handleListFolder } from './folder/list-folder-handler'

export const registerIpc = (): void => {
  ipcMain.handle('file:create', (_event, path: string) => handleCreateFile(path))
  ipcMain.handle('file:delete', (_event, path: string) => handleDeleteFile(path))
  ipcMain.handle('folder:create', (_event, path: string) => handleCreateFolder(path))
  ipcMain.handle('folder:delete', (_event, path: string) => handleDeleteFolder(path))
  ipcMain.handle('folder:list', (_event, path: string) => handleListFolder(path))
}
