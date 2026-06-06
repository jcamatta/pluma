// Use case: delete a folder at a path. Validates the folder path (non-empty, no reserved .pluma
// segment), then delegates the recursive removal to the FolderWriter port. Fails with a typed
// FolderDeletionError on any problem.

import * as Effect from 'effect/Effect'
import type { FolderDeletionError } from '../error/folder-deletion-error'
import { FolderWriter } from '../port/folder-writer.port'
import type { FolderWriterPort } from '../port/folder-writer.port'
import { validateFolderPath } from '../logic/validate-folder-path'

export const deleteFolder = (
  path: string
): Effect.Effect<string, FolderDeletionError, FolderWriterPort> =>
  Effect.gen(function* () {
    const validPath = yield* validateFolderPath(path)
    const writer = yield* FolderWriter
    yield* writer.deleteFolder(validPath)
    return validPath
  })
