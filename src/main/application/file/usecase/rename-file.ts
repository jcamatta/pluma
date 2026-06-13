// Use case: rename a file from oldPath to newPath. Validates both paths (trimmed, non-empty, .md),
// then delegates the move to the FileWriter port. Returns the validated new path on success; fails
// with a typed FileRenameError on any problem.

import * as Effect from 'effect/Effect'
import type { FileRenameError } from '../error/file-rename-error'
import { FileWriter } from '../port/file-writer.port'
import type { FileWriterPort } from '../port/file-writer.port'
import { validateMarkdownPath } from '../logic/validate-markdown-path'

export const renameFile = (
  oldPath: string,
  newPath: string
): Effect.Effect<string, FileRenameError, FileWriterPort> =>
  Effect.gen(function* () {
    const validOld = yield* validateMarkdownPath(oldPath)
    const validNew = yield* validateMarkdownPath(newPath)
    const writer = yield* FileWriter
    yield* writer.renameFile(validOld, validNew)
    return validNew
  })
