// Use case: create a folder at a path. Validates the folder path (non-empty, no reserved .pluma
// segment), then delegates the creation to the FolderWriter port. Fails with a typed
// FolderCreationError on any problem.

import * as Effect from 'effect/Effect'
import type { FolderCreationError } from '../error/folder-creation-error'
import { FolderWriter } from '../port/folder-writer.port'
import type { FolderWriterPort } from '../port/folder-writer.port'
import { validateFolderPath } from '../logic/validate-folder-path'

export const createFolder = (
  path: string
): Effect.Effect<string, FolderCreationError, FolderWriterPort> =>
  Effect.gen(function* () {
    const validPath = yield* validateFolderPath(path)
    const writer = yield* FolderWriter
    yield* writer.createFolder(validPath)
    return validPath
  })
