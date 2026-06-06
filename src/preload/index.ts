import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { BaseEvent } from '@ag-ui/core'
import type { RunAgentInput } from '../main/application/agent/data/run-agent-input'

// Custom APIs for renderer
const api = {
  createFile: (path: string) => ipcRenderer.invoke('file:create', path),
  deleteFile: (path: string) => ipcRenderer.invoke('file:delete', path),
  writeFile: (path: string, content: string) => ipcRenderer.invoke('file:write', { path, content }),
  createFolder: (path: string) => ipcRenderer.invoke('folder:create', path),
  deleteFolder: (path: string) => ipcRenderer.invoke('folder:delete', path),
  listFolder: (path: string) => ipcRenderer.invoke('folder:list', path),
  pickFolder: () => ipcRenderer.invoke('folder:pick'),
  watchFolder: (path: string) => ipcRenderer.invoke('folder:watch', path),
  onFolderChanged: (
    listener: (event: { type: 'created' | 'updated' | 'deleted'; path: string }) => void
  ) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      payload: { type: 'created' | 'updated' | 'deleted'; path: string }
    ): void => listener(payload)
    ipcRenderer.on('folder:changed', handler)
    return () => ipcRenderer.removeListener('folder:changed', handler)
  },
  runAgent: (input: RunAgentInput) => ipcRenderer.invoke('agent:run', input),
  abortAgent: (runId: string) => ipcRenderer.invoke('agent:abort', runId),
  onAgentEvent: (listener: (event: BaseEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: BaseEvent): void =>
      listener(payload)
    ipcRenderer.on('agent:event', handler)
    return () => ipcRenderer.removeListener('agent:event', handler)
  }
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
