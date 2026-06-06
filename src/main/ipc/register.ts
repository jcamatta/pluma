// Registers IPC endpoints on the main process. Each ipcMain.handle channel calls a handler that runs a
// use case and returns a plain Result. The stateless command/query channels register once at app-ready
// via registerIpc. folder:watch and agent:run need the window to push events to the renderer, so they
// register per-window (registerWatch / registerAgent); removeHandler keeps them idempotent across window
// re-creation on macOS.

import { ipcMain } from 'electron'
import type { BaseEvent } from '@ag-ui/core'
import type * as Scope from 'effect/Scope'
import type { RunAgentInput } from '../application/agent/data/run-agent-input'
import type { FileEvent } from '../application/folder/data/file-event'
import { handleAbortAgent } from './agent/abort-agent-handler'
import { handleRunAgent } from './agent/run-agent-handler'
import { handleCreateFile } from './file/create-file-handler'
import { handleDeleteFile } from './file/delete-file-handler'
import { handleWriteFile } from './file/write-file-handler'
import { handleCreateFolder } from './folder/create-folder-handler'
import { handleDeleteFolder } from './folder/delete-folder-handler'
import { handleListFolder } from './folder/list-folder-handler'
import { handlePickFolder } from './folder/pick-folder-handler'
import { handleWatchFolder } from './folder/watch-folder-handler'

const registerIpc = (): void => {
  ipcMain.handle('file:create', (_event, path: string) => handleCreateFile(path))
  ipcMain.handle('file:delete', (_event, path: string) => handleDeleteFile(path))
  ipcMain.handle('file:write', (_event, payload: { path: string; content: string }) =>
    handleWriteFile(payload.path, payload.content)
  )
  ipcMain.handle('folder:create', (_event, path: string) => handleCreateFolder(path))
  ipcMain.handle('folder:delete', (_event, path: string) => handleDeleteFolder(path))
  ipcMain.handle('folder:list', (_event, path: string) => handleListFolder(path))
  ipcMain.handle('folder:pick', () => handlePickFolder())
  ipcMain.handle('agent:abort', (_event, runId: string) => handleAbortAgent(runId))
}

interface EventTarget {
  readonly isDestroyed: () => boolean
  readonly webContents: { readonly send: (channel: string, payload: FileEvent | BaseEvent) => void }
}

interface WatchDeps {
  readonly window: EventTarget
  readonly scope: Scope.Scope
}

const registerWatch = (deps: WatchDeps): void => {
  ipcMain.removeHandler('folder:watch')
  ipcMain.handle('folder:watch', (_event, path: string) =>
    handleWatchFolder({
      path,
      scope: deps.scope,
      send: (event: FileEvent) => {
        if (!deps.window.isDestroyed()) {
          deps.window.webContents.send('folder:changed', event)
        }
      }
    })
  )
}

const registerAgent = (window: EventTarget): void => {
  ipcMain.removeHandler('agent:run')
  ipcMain.handle('agent:run', (_event, input: RunAgentInput) =>
    handleRunAgent({
      input,
      send: (event: BaseEvent) => {
        if (!window.isDestroyed()) {
          window.webContents.send('agent:event', event)
        }
      }
    })
  )
}

export { registerIpc, registerWatch, registerAgent }
