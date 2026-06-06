import { ElectronAPI } from '@electron-toolkit/preload'

type Result<T, E extends { _tag: string }> = { ok: true; value: T } | { ok: false; error: E }

type CreateFileError = {
  _tag: 'InvalidPath' | 'FileAlreadyExists' | 'DirectoryNotFound' | 'FileWriteFailed'
  path: string
}

type DeleteFileError = {
  _tag: 'InvalidPath' | 'FileNotFound' | 'FileDeleteFailed'
  path: string
}

type CreateFolderError = {
  _tag:
    | 'InvalidFolderPath'
    | 'FolderAlreadyExists'
    | 'ParentDirectoryNotFound'
    | 'FolderCreationFailed'
  path: string
}

interface Api {
  createFile: (path: string) => Promise<Result<string, CreateFileError>>
  deleteFile: (path: string) => Promise<Result<string, DeleteFileError>>
  createFolder: (path: string) => Promise<Result<string, CreateFolderError>>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
  }
}
