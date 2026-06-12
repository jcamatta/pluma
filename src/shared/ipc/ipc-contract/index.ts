// The request/response IPC registry. Every channel's contract joins the IpcContract union, and the
// per-channel views (input, value, error, result) are derived from it by matching on the channel
// literal. Adding a channel is one edit here plus its contract file; both the main ipc handlers and
// the preload bridge then see it automatically.

import type { Result } from '../ipc-result'
import type {
  AgentAbortContract,
  AgentDeleteThreadContract,
  AgentListThreadsContract,
  AgentRenameThreadContract,
  AgentRunContract,
  AgentThreadHistoryContract,
  AgentToolResultContract
} from './agent'
import type {
  FileCreateContract,
  FileDeleteContract,
  FileWriteContract,
  FileReadContract
} from './file'
import type {
  FolderCreateContract,
  FolderDeleteContract,
  FolderRenameContract,
  FolderListContract,
  FolderPickContract,
  FolderWatchContract
} from './folder'

type IpcContract =
  | FileCreateContract
  | FileDeleteContract
  | FileWriteContract
  | FileReadContract
  | FolderCreateContract
  | FolderDeleteContract
  | FolderRenameContract
  | FolderListContract
  | FolderPickContract
  | FolderWatchContract
  | AgentRunContract
  | AgentAbortContract
  | AgentToolResultContract
  | AgentListThreadsContract
  | AgentThreadHistoryContract
  | AgentRenameThreadContract
  | AgentDeleteThreadContract

type IpcChannel = IpcContract['channel']

type ContractByChannel<Channel extends IpcChannel> = Extract<
  IpcContract,
  { readonly channel: Channel }
>

type IpcInput<Channel extends IpcChannel> = ContractByChannel<Channel>['input']

type IpcValue<Channel extends IpcChannel> = ContractByChannel<Channel>['value']

type IpcError<Channel extends IpcChannel> = ContractByChannel<Channel>['error']

type IpcResult<Channel extends IpcChannel> = Result<IpcValue<Channel>, IpcError<Channel>>

export type { IpcContract, IpcChannel, IpcInput, IpcValue, IpcError, IpcResult }
