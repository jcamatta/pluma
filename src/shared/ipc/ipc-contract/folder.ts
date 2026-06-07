// Wire contracts for the folder channels. FolderEntry is the wire shape of one listed child; it is
// declared here so the renderer can read it without importing the application layer's own Entry type.
// The error shapes are the serialized tagged errors the main handlers produce from the folder use
// cases. folder:watch returns only an ack: the FileEvent stream cannot cross IPC, so changes arrive on
// the separate folder:changed event channel.

import type { IpcContractDefinition } from './types'

const FOLDER_CREATE_CHANNEL = 'folder:create'
const FOLDER_DELETE_CHANNEL = 'folder:delete'
const FOLDER_LIST_CHANNEL = 'folder:list'
const FOLDER_PICK_CHANNEL = 'folder:pick'
const FOLDER_WATCH_CHANNEL = 'folder:watch'

interface FolderEntry {
  readonly name: string
  readonly type: 'file' | 'directory'
}

interface FolderCreateError {
  readonly _tag:
    | 'InvalidFolderPath'
    | 'FolderAlreadyExists'
    | 'ParentDirectoryNotFound'
    | 'FolderCreationFailed'
  readonly path: string
}

interface FolderDeleteError {
  readonly _tag: 'InvalidFolderPath' | 'FolderNotFound' | 'FolderDeleteFailed'
  readonly path: string
}

interface FolderListError {
  readonly _tag: 'InvalidFolderPath' | 'FolderNotFound' | 'FolderReadFailed'
  readonly path: string
}

interface FolderPickError {
  readonly _tag: 'FolderSelectionCancelled' | 'FolderSelectionFailed'
}

interface FolderWatchError {
  readonly _tag: 'FolderWatchFailed'
  readonly path: string
}

type FolderCreateContract = IpcContractDefinition<
  typeof FOLDER_CREATE_CHANNEL,
  string,
  string,
  FolderCreateError
>

type FolderDeleteContract = IpcContractDefinition<
  typeof FOLDER_DELETE_CHANNEL,
  string,
  string,
  FolderDeleteError
>

type FolderListContract = IpcContractDefinition<
  typeof FOLDER_LIST_CHANNEL,
  string,
  ReadonlyArray<FolderEntry>,
  FolderListError
>

type FolderPickContract = IpcContractDefinition<
  typeof FOLDER_PICK_CHANNEL,
  void,
  string,
  FolderPickError
>

type FolderWatchContract = IpcContractDefinition<
  typeof FOLDER_WATCH_CHANNEL,
  string,
  null,
  FolderWatchError
>

export {
  FOLDER_CREATE_CHANNEL,
  FOLDER_DELETE_CHANNEL,
  FOLDER_LIST_CHANNEL,
  FOLDER_PICK_CHANNEL,
  FOLDER_WATCH_CHANNEL,
  type FolderEntry,
  type FolderCreateError,
  type FolderDeleteError,
  type FolderListError,
  type FolderPickError,
  type FolderWatchError,
  type FolderCreateContract,
  type FolderDeleteContract,
  type FolderListContract,
  type FolderPickContract,
  type FolderWatchContract
}
