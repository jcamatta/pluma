// Registers IPC endpoints on the main process. Each ipcMain.handle channel calls a handler that runs a
// use case and returns a plain Result. Channel strings come from the shared IPC contract, so main and
// the preload bridge agree on every name. The stateless command/query channels register once at
// app-ready via registerIpc. folder:watch and agent:run need the window to push events to the renderer,
// so they register per-window (registerWatch / registerAgent); removeHandler keeps them idempotent
// across window re-creation on macOS.

import { ipcMain } from 'electron'
import type { BaseEvent } from '@ag-ui/core'
import type * as Scope from 'effect/Scope'
import {
  AGENT_ABORT_CHANNEL,
  AGENT_RUN_CHANNEL,
  type RunAgentInput
} from '../../shared/ipc/ipc-contract/agent'
import {
  FILE_CREATE_CHANNEL,
  FILE_DELETE_CHANNEL,
  FILE_WRITE_CHANNEL,
  FILE_READ_CHANNEL
} from '../../shared/ipc/ipc-contract/file'
import {
  FOLDER_CREATE_CHANNEL,
  FOLDER_DELETE_CHANNEL,
  FOLDER_LIST_CHANNEL,
  FOLDER_PICK_CHANNEL,
  FOLDER_WATCH_CHANNEL
} from '../../shared/ipc/ipc-contract/folder'
import { AGENT_EVENT_CHANNEL } from '../../shared/ipc/ipc-event-contract/agent'
import {
  FOLDER_CHANGED_CHANNEL,
  type FolderChange
} from '../../shared/ipc/ipc-event-contract/folder'
import { handleAbortAgent } from './agent/abort-agent-handler'
import { handleRunAgent } from './agent/run-agent-handler'
import { handleCreateFile } from './file/create-file-handler'
import { handleDeleteFile } from './file/delete-file-handler'
import { handleWriteFile } from './file/write-file-handler'
import { handleReadFile } from './file/read-file-handler'
import { handleCreateFolder } from './folder/create-folder-handler'
import { handleDeleteFolder } from './folder/delete-folder-handler'
import { handleListFolder } from './folder/list-folder-handler'
import { handlePickFolder } from './folder/pick-folder-handler'
import { handleWatchFolder } from './folder/watch-folder-handler'

const registerIpc = (): void => {
  ipcMain.handle(FILE_CREATE_CHANNEL, (_event, path: string) => handleCreateFile(path))
  ipcMain.handle(FILE_DELETE_CHANNEL, (_event, path: string) => handleDeleteFile(path))
  ipcMain.handle(FILE_WRITE_CHANNEL, (_event, payload: { path: string; content: string }) =>
    handleWriteFile(payload.path, payload.content)
  )
  ipcMain.handle(FILE_READ_CHANNEL, (_event, path: string) => handleReadFile(path))
  ipcMain.handle(FOLDER_CREATE_CHANNEL, (_event, path: string) => handleCreateFolder(path))
  ipcMain.handle(FOLDER_DELETE_CHANNEL, (_event, path: string) => handleDeleteFolder(path))
  ipcMain.handle(FOLDER_LIST_CHANNEL, (_event, path: string) => handleListFolder(path))
  ipcMain.handle(FOLDER_PICK_CHANNEL, () => handlePickFolder())
  ipcMain.handle(AGENT_ABORT_CHANNEL, (_event, runId: string) => handleAbortAgent(runId))
}

interface EventTarget {
  readonly isDestroyed: () => boolean
  readonly webContents: {
    readonly send: (channel: string, payload: FolderChange | BaseEvent) => void
  }
}

interface WatchDeps {
  readonly window: EventTarget
  readonly scope: Scope.Scope
}

const registerWatch = (deps: WatchDeps): void => {
  ipcMain.removeHandler(FOLDER_WATCH_CHANNEL)
  ipcMain.handle(FOLDER_WATCH_CHANNEL, (_event, path: string) =>
    handleWatchFolder({
      path,
      scope: deps.scope,
      send: (event: FolderChange) => {
        if (!deps.window.isDestroyed()) {
          deps.window.webContents.send(FOLDER_CHANGED_CHANNEL, event)
        }
      }
    })
  )
}

const registerAgent = (window: EventTarget): void => {
  ipcMain.removeHandler(AGENT_RUN_CHANNEL)
  ipcMain.handle(AGENT_RUN_CHANNEL, (_event, input: RunAgentInput) =>
    handleRunAgent({
      input,
      send: (event: BaseEvent) => {
        if (!window.isDestroyed()) {
          window.webContents.send(AGENT_EVENT_CHANNEL, event)
        }
      }
    })
  )
}

export { registerIpc, registerWatch, registerAgent }
