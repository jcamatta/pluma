// Use case: create an empty markdown file at a path. Validates that the path targets a .md file,
// then delegates the write to the FileWriter port. Fails with a typed FileCreationError on any problem.

import * as Effect from 'effect/Effect'
import type { FileCreationError } from './error/file-creation-error'
import { InvalidPath } from './error/invalid-path'
import { FileWriter } from './file-writer.port'
import type { FileWriterPort } from './file-writer.port'

const validateMarkdownPath = (path: string): Effect.Effect<string, InvalidPath> => {
  const trimmed = path.trim()
  const isMarkdown = trimmed.length > '.md'.length && trimmed.toLowerCase().endsWith('.md')
  return isMarkdown ? Effect.succeed(trimmed) : Effect.fail(new InvalidPath({ path }))
}

export const createFile = (
  path: string
): Effect.Effect<string, FileCreationError, FileWriterPort> =>
  Effect.gen(function* () {
    const validPath = yield* validateMarkdownPath(path)
    const writer = yield* FileWriter
    yield* writer.createEmptyFile(validPath)
    return validPath
  })
