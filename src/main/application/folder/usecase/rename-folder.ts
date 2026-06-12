// Use case: rename a folder from oldPath to newPath. Validates both paths (non-empty, no empty
// segments), then delegates the move to the FolderWriter port. Returns the validated new path on
// success; fails with a typed FolderRenameError on any problem.

import * as Effect from 'effect/Effect'
import type { FolderRenameError } from '../error/folder-rename-error'
import { FolderWriter } from '../port/folder-writer.port'
import type { FolderWriterPort } from '../port/folder-writer.port'
import { validateFolderPath } from '../logic/validate-folder-path'

export const renameFolder = (
  oldPath: string,
  newPath: string
): Effect.Effect<string, FolderRenameError, FolderWriterPort> =>
  Effect.gen(function* () {
    const validOld = yield* validateFolderPath(oldPath)
    const validNew = yield* validateFolderPath(newPath)
    const writer = yield* FolderWriter
    yield* writer.renameFolder(validOld, validNew)
    return validNew
  })
