import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  createFile: (path: string) => ipcRenderer.invoke('file:create', path),
  deleteFile: (path: string) => ipcRenderer.invoke('file:delete', path),
  createFolder: (path: string) => ipcRenderer.invoke('folder:create', path),
  deleteFolder: (path: string) => ipcRenderer.invoke('folder:delete', path)
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
