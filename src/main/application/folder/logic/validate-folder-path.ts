// Business rule for folder paths: the trimmed path must be non-empty. Returns the trimmed path on
// success, fails with InvalidFolderPath. This is application logic, not enforced by the adapter.

import * as Effect from 'effect/Effect'
import { InvalidFolderPath } from '../error/invalid-folder-path'

export const validateFolderPath = (path: string): Effect.Effect<string, InvalidFolderPath> => {
  const trimmed = path.trim()
  const segments = trimmed.split(/[/\\]/).filter((segment) => segment.length > 0)
  const isValid = segments.length > 0
  return isValid ? Effect.succeed(trimmed) : Effect.fail(new InvalidFolderPath({ path }))
}
