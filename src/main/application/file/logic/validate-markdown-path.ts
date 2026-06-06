// Shared path validation for the file use cases: a valid target is a trimmed, non-empty path that
// ends in .md (case-insensitive). Returns the trimmed path on success, fails with InvalidPath.

import * as Effect from 'effect/Effect'
import { InvalidPath } from '../error/invalid-path'

export const validateMarkdownPath = (path: string): Effect.Effect<string, InvalidPath> => {
  const trimmed = path.trim()
  const isMarkdown = trimmed.length > '.md'.length && trimmed.toLowerCase().endsWith('.md')
  return isMarkdown ? Effect.succeed(trimmed) : Effect.fail(new InvalidPath({ path }))
}
