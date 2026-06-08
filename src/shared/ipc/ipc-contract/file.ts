// Wire contracts for the file channels. The error shapes are the serialized tagged errors the main
// handlers produce from the file use cases; they are declared here (not imported from the application
// layer) so the wire contract stays independent of main internals and the renderer can read it.

import type { IpcContractDefinition } from './types'

const FILE_CREATE_CHANNEL = 'file:create'
const FILE_DELETE_CHANNEL = 'file:delete'
const FILE_WRITE_CHANNEL = 'file:write'
const FILE_READ_CHANNEL = 'file:read'

interface FileCreateError {
  readonly _tag: 'InvalidPath' | 'FileAlreadyExists' | 'DirectoryNotFound' | 'FileWriteFailed'
  readonly path: string
}

interface FileDeleteError {
  readonly _tag: 'InvalidPath' | 'FileNotFound' | 'FileDeleteFailed'
  readonly path: string
}

interface FileWriteError {
  readonly _tag: 'InvalidPath' | 'FileNotFound' | 'FileWriteFailed'
  readonly path: string
}

interface FileReadError {
  readonly _tag: 'InvalidPath' | 'FileNotFound' | 'FileReadFailed'
  readonly path: string
}

type FileCreateContract = IpcContractDefinition<
  typeof FILE_CREATE_CHANNEL,
  string,
  string,
  FileCreateError
>

type FileDeleteContract = IpcContractDefinition<
  typeof FILE_DELETE_CHANNEL,
  string,
  string,
  FileDeleteError
>

type FileWriteContract = IpcContractDefinition<
  typeof FILE_WRITE_CHANNEL,
  { readonly path: string; readonly content: string },
  string,
  FileWriteError
>

type FileReadContract = IpcContractDefinition<
  typeof FILE_READ_CHANNEL,
  string,
  string,
  FileReadError
>

export {
  FILE_CREATE_CHANNEL,
  FILE_DELETE_CHANNEL,
  FILE_WRITE_CHANNEL,
  FILE_READ_CHANNEL,
  type FileCreateError,
  type FileDeleteError,
  type FileWriteError,
  type FileReadError,
  type FileCreateContract,
  type FileDeleteContract,
  type FileWriteContract,
  type FileReadContract
}
