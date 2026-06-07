// The event IPC registry. Every event channel's contract joins the IpcEventContract union, and the
// per-channel payload and callback types are derived from it by matching on the channel literal.

import type { AgentEventContract } from './agent'
import type { FolderChangedContract } from './folder'

type IpcEventContract = FolderChangedContract | AgentEventContract

type IpcEventChannel = IpcEventContract['channel']

type EventContractByChannel<Channel extends IpcEventChannel> = Extract<
  IpcEventContract,
  { readonly channel: Channel }
>

type IpcEventPayload<Channel extends IpcEventChannel> = EventContractByChannel<Channel>['payload']

type IpcEventCallback<Channel extends IpcEventChannel> = (payload: IpcEventPayload<Channel>) => void

export type { IpcEventContract, IpcEventChannel, IpcEventPayload, IpcEventCallback }
