// Use case: create an empty markdown file at a path. Validates that the path targets a .md file,
// then delegates the write to the FileWriter port. Fails with a typed FileCreationError on any problem.

import * as Effect from 'effect/Effect'
import type { FileCreationError } from '../error/file-creation-error'
import { FileWriter } from '../port/file-writer.port'
import type { FileWriterPort } from '../port/file-writer.port'
import { validateMarkdownPath } from '../logic/validate-markdown-path'

export const createFile = (
  path: string
): Effect.Effect<string, FileCreationError, FileWriterPort> =>
  Effect.gen(function* () {
    const validPath = yield* validateMarkdownPath(path)
    const writer = yield* FileWriter
    yield* writer.createEmptyFile(validPath)
    return validPath
  })
