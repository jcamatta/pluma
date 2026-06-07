import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { IpcChannel, IpcInput, IpcResult } from '../shared/ipc/ipc-contract'
import type {
  IpcEventCallback,
  IpcEventChannel,
  IpcEventPayload
} from '../shared/ipc/ipc-event-contract'
import type { WindowApi } from '../shared/ipc/window-api'
import { assertWire } from '../shared/ipc/from-wire'

// The whole renderer-facing surface is two generic methods derived from the shared contract, not one
// bespoke method per channel. `invoke` forwards a request/response call; the channel literal selects
// the input it requires and the Result it resolves to. `on` subscribes to an event channel and returns
// an unsubscribe function. This is the single trusted boundary where wire data becomes typed: Electron
// resolves invoke to `any` and pushes event payloads via its own listener type, so the contract's
// IpcResult<Channel> / IpcEventPayload<Channel> are what give those values their shape downstream.
const invoke = <Channel extends IpcChannel>(
  channel: Channel,
  ...args: IpcInput<Channel> extends void ? [] : [payload: IpcInput<Channel>]
): Promise<IpcResult<Channel>> => ipcRenderer.invoke(channel, ...args)

const on = <Channel extends IpcEventChannel>(
  channel: Channel,
  callback: IpcEventCallback<Channel>
): (() => void) => {
  // The listener takes the payload as `unknown` (so it stays assignable to Electron's listener type)
  // and assertWire narrows it to this channel's IpcEventPayload before the callback. The same listener
  // reference is used to add and remove, so unsubscribe works.
  const listener = (_event: Electron.IpcRendererEvent, payload: unknown): void => {
    assertWire<IpcEventPayload<Channel>>(payload, channel)
    callback(payload)
  }
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: WindowApi = { invoke, on }

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('electron', electronAPI)
  contextBridge.exposeInMainWorld('api', api)
} else {
  window.electron = electronAPI
  window.api = api
}
