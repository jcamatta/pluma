// In-memory fake of the explorer's repository ports for hook/controller tests. Backed by a Map from
// folder path to its entries; implements the reader (list) and writer (create/delete/watch/onChange)
// and returns Result values exactly like the real IPC adapter — ok: false is a value, never thrown.
// `emit` lets a test fire a folder:changed event the watcher subscribers receive. No window.api, no
// Electron: the single seam the tests drive instead of the real adapter.

import type { Result } from '../../../../shared/ipc/ipc-result'
import type { FolderEntry } from '../../../../shared/ipc/ipc-contract/folder'
import type { FolderChange } from '../../../../shared/ipc/ipc-event-contract/folder'
import type { FolderReaderPort } from '../ports/folder-reader.port'
import type { FolderWriterPort } from '../ports/folder-writer.port'
import type { FileReaderPort } from '../ports/file-reader.port'
import type { FileWriterPort } from '../ports/file-writer.port'
import type { Repositories } from '../RepositoriesContext'

type FakeRepository = Repositories & {
  readonly emit: (change: FolderChange) => void
  readonly created: () => readonly string[]
  readonly deleted: () => readonly string[]
  readonly renamed: () => readonly { readonly from: string; readonly to: string }[]
  readonly written: () => readonly { readonly path: string; readonly content: string }[]
}

function createFakeFolderRepository(
  listings: Readonly<Record<string, readonly FolderEntry[]>>,
  files: Readonly<Record<string, string>> = {}
): FakeRepository {
  const subscribers = new Set<(change: FolderChange) => void>()
  const created: string[] = []
  const deleted: string[] = []
  const renamed: { from: string; to: string }[] = []
  const written: { path: string; content: string }[] = []

  const reader: FolderReaderPort = {
    list: (path) => {
      const entries = listings[path]
      const result: Result<readonly FolderEntry[], { _tag: 'FolderNotFound'; path: string }> =
        entries
          ? { ok: true, value: entries }
          : { ok: false, error: { _tag: 'FolderNotFound', path } }
      return Promise.resolve(result)
    }
  }

  const fileReader: FileReaderPort = {
    read: (path) => {
      const content = files[path]
      const result: Result<string, { _tag: 'FileNotFound'; path: string }> =
        content === undefined
          ? { ok: false, error: { _tag: 'FileNotFound', path } }
          : { ok: true, value: content }
      return Promise.resolve(result)
    }
  }

  const record = (bucket: string[], path: string): Promise<Result<string, never>> => {
    bucket.push(path)
    return Promise.resolve({ ok: true, value: path })
  }

  // Mirror the backend's create-file contract: a created file is normalized to a .md path and that
  // normalized path is what comes back, so selection-on-create tests are faithful to the real adapter.
  const createFile = (path: string): Promise<Result<string, never>> =>
    record(created, path.toLowerCase().endsWith('.md') ? path : `${path}.md`)

  const fileWriter: FileWriterPort = {
    write: (path, content) => {
      written.push({ path, content })
      return Promise.resolve({ ok: true, value: path })
    }
  }

  const writer: FolderWriterPort = {
    createFile,
    createFolder: (path) => record(created, path),
    deleteFile: (path) => record(deleted, path),
    deleteFolder: (path) => record(deleted, path),
    renameFile: (oldPath, newPath) => {
      renamed.push({ from: oldPath, to: newPath })
      return Promise.resolve({ ok: true, value: newPath })
    },
    renameFolder: (oldPath, newPath) => {
      renamed.push({ from: oldPath, to: newPath })
      return Promise.resolve({ ok: true, value: newPath })
    },
    watch: () => Promise.resolve({ ok: true, value: null }),
    onChange: (callback) => {
      subscribers.add(callback)
      return () => subscribers.delete(callback)
    }
  }

  return {
    reader,
    writer,
    fileReader,
    fileWriter,
    emit: (change) => subscribers.forEach((cb) => cb(change)),
    created: () => created,
    deleted: () => deleted,
    renamed: () => renamed,
    written: () => written
  }
}

export { createFakeFolderRepository }
export type { FakeRepository }
