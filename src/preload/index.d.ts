import { ElectronAPI } from '@electron-toolkit/preload'

type Result<T, E extends { _tag: string }> = { ok: true; value: T } | { ok: false; error: E }

type CreateFileError = {
  _tag: 'InvalidPath' | 'FileAlreadyExists' | 'DirectoryNotFound' | 'FileWriteFailed'
  path: string
}

interface Api {
  createFile: (path: string) => Promise<Result<string, CreateFileError>>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
  }
}
