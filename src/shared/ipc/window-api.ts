// The single type the preload bridge exposes as window.api. `invoke` covers every request/response
// channel: the channel literal selects the input it requires (none for void-input channels) and the
// Result it resolves to. `on` covers every event channel: it selects the payload the callback
// receives and returns an unsubscribe function. Both the preload implementation and the renderer
// consumers are typed by this one shape, derived entirely from the contract registries.

import type { IpcChannel, IpcInput, IpcResult } from './ipc-contract'
import type { IpcEventCallback, IpcEventChannel } from './ipc-event-contract'

export interface WindowApi {
  readonly invoke: <Channel extends IpcChannel>(
    channel: Channel,
    ...args: IpcInput<Channel> extends void ? [] : [payload: IpcInput<Channel>]
  ) => Promise<IpcResult<Channel>>
  readonly on: <Channel extends IpcEventChannel>(
    channel: Channel,
    callback: IpcEventCallback<Channel>
  ) => () => void
}
