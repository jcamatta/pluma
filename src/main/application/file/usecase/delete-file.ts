// Use case: delete a markdown file at a path. Validates that the path targets a .md file, then
// delegates the removal to the FileWriter port. Fails with a typed FileDeletionError on any problem.

import * as Effect from 'effect/Effect'
import type { FileDeletionError } from '../error/file-deletion-error'
import { FileWriter } from '../port/file-writer.port'
import type { FileWriterPort } from '../port/file-writer.port'
import { validateMarkdownPath } from '../logic/validate-markdown-path'

export const deleteFile = (
  path: string
): Effect.Effect<string, FileDeletionError, FileWriterPort> =>
  Effect.gen(function* () {
    const validPath = yield* validateMarkdownPath(path)
    const writer = yield* FileWriter
    yield* writer.deleteFile(validPath)
    return validPath
  })
