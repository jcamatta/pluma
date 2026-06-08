// Use case: read the content of an existing markdown file. Validates that the path targets a .md
// file, then delegates the read to the FileReader port. Fails with a typed FileReadingError on any
// problem.

import * as Effect from 'effect/Effect'
import type { FileReadingError } from '../error/file-reading-error'
import { FileReader } from '../port/file-reader.port'
import type { FileReaderPort } from '../port/file-reader.port'
import { validateMarkdownPath } from '../logic/validate-markdown-path'

export const readFile = (path: string): Effect.Effect<string, FileReadingError, FileReaderPort> =>
  Effect.gen(function* () {
    const validPath = yield* validateMarkdownPath(path)
    const reader = yield* FileReader
    return yield* reader.readFile(validPath)
  })
