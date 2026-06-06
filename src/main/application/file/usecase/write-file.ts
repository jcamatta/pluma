// Use case: write content to an existing markdown file. Validates that the path targets a .md file,
// then delegates the write to the FileWriter port. Fails with a typed FileWritingError on any problem.

import * as Effect from 'effect/Effect'
import type { FileWritingError } from '../error/file-writing-error'
import { FileWriter } from '../port/file-writer.port'
import type { FileWriterPort } from '../port/file-writer.port'
import { validateMarkdownPath } from '../logic/validate-markdown-path'

export const writeFile = (
  path: string,
  content: string
): Effect.Effect<string, FileWritingError, FileWriterPort> =>
  Effect.gen(function* () {
    const validPath = yield* validateMarkdownPath(path)
    const writer = yield* FileWriter
    yield* writer.writeFile(validPath, content)
    return validPath
  })
