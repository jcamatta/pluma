// Re-point git's core.hooksPath at the main checkout's `.husky/_` by absolute path.
//
// husky's `prepare` step sets core.hooksPath to the relative `.husky/_`. Git resolves a relative
// hooksPath against each working tree's own root, and a linked worktree has no `.husky/_` of its own —
// so git finds no hooks there and silently skips every gate (veto, lint-staged, commit-size, pre-push,
// commit-msg). Deriving the absolute path from the git common dir makes every worktree resolve the same
// real hooks. The value lives only in local `.git/config` (never committed); this runs after husky on
// each install so it self-heals per machine and clone.

import { execSync } from 'node:child_process'
import { join, resolve } from 'node:path'

try {
  const commonDir = execSync('git rev-parse --git-common-dir', { encoding: 'utf8' }).trim()
  const hooksPath = resolve(join(commonDir, '..', '.husky', '_')).replace(/\\/g, '/')
  execSync(`git config core.hooksPath "${hooksPath}"`)
} catch {
  // Not a git checkout (e.g. an install from a tarball in CI) — there is nothing to re-point.
}
