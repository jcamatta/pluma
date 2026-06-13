// The real explorer repository adapter: implements the reader and writer ports over the preload
// window.api bridge. It passes each IPC Result through unchanged (ok: false is a value, not an error)
// and forwards folder:changed events to onChange subscribers. This is the only explorer module that
// touches window.api; everything above it depends on the ports.

import {
  FOLDER_CREATE_CHANNEL,
  FOLDER_DELETE_CHANNEL,
  FOLDER_RENAME_CHANNEL,
  FOLDER_LIST_CHANNEL,
  FOLDER_WATCH_CHANNEL
} from '../../../../shared/ipc/ipc-contract/folder'
import {
  FILE_CREATE_CHANNEL,
  FILE_DELETE_CHANNEL,
  FILE_READ_CHANNEL,
  FILE_WRITE_CHANNEL
} from '../../../../shared/ipc/ipc-contract/file'
import { FOLDER_CHANGED_CHANNEL } from '../../../../shared/ipc/ipc-event-contract/folder'
import type { FolderReaderPort } from '../ports/folder-reader.port'
import type { FolderWriterPort } from '../ports/folder-writer.port'
import type { FileReaderPort } from '../ports/file-reader.port'
import type { FileWriterPort } from '../ports/file-writer.port'

function createFolderRepository(): {
  readonly reader: FolderReaderPort
  readonly writer: FolderWriterPort
  readonly fileReader: FileReaderPort
  readonly fileWriter: FileWriterPort
} {
  const reader: FolderReaderPort = {
    list: (path) => window.api.invoke(FOLDER_LIST_CHANNEL, path)
  }

  const fileReader: FileReaderPort = {
    read: (path) => window.api.invoke(FILE_READ_CHANNEL, path)
  }

  const fileWriter: FileWriterPort = {
    write: (path, content) => window.api.invoke(FILE_WRITE_CHANNEL, { path, content })
  }

  const writer: FolderWriterPort = {
    createFile: (path) => window.api.invoke(FILE_CREATE_CHANNEL, path),
    createFolder: (path) => window.api.invoke(FOLDER_CREATE_CHANNEL, path),
    deleteFile: (path) => window.api.invoke(FILE_DELETE_CHANNEL, path),
    deleteFolder: (path) => window.api.invoke(FOLDER_DELETE_CHANNEL, path),
    renameFolder: (oldPath, newPath) =>
      window.api.invoke(FOLDER_RENAME_CHANNEL, { oldPath, newPath }),
    watch: (path) => window.api.invoke(FOLDER_WATCH_CHANNEL, path),
    onChange: (callback) => window.api.on(FOLDER_CHANGED_CHANNEL, callback)
  }

  return { reader, writer, fileReader, fileWriter }
}

export { createFolderRepository }
