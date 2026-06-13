// Use case: list the immediate children of a folder. Validates the folder path (non-empty), then
// delegates the directory read to the FolderReader port and keeps only directories and Markdown files.
// Returns the filtered entries on success, or a typed FolderListingError on any problem. Listing is one
// level deep; the explorer re-lists to expand a subfolder.

import * as Effect from 'effect/Effect'
import type { FolderEntry } from '../data/entry'
import type { FolderListingError } from '../error/folder-listing-error'
import { FolderReader } from '../port/folder-reader.port'
import type { FolderReaderPort } from '../port/folder-reader.port'
import { validateFolderPath } from '../logic/validate-folder-path'
import { keepMarkdownEntries } from '../logic/keep-markdown-entries'

export const listFolder = (
  path: string
): Effect.Effect<ReadonlyArray<FolderEntry>, FolderListingError, FolderReaderPort> =>
  Effect.gen(function* () {
    const validPath = yield* validateFolderPath(path)
    const reader = yield* FolderReader
    const entries = yield* reader.listFolder(validPath)
    return keepMarkdownEntries(entries)
  })
