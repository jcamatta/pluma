// Tests for findClaudeExecutable against real temporary directories, since the whole point of the
// lookup is what is on disk. Covers the shapes that decide a packaged build's fate: the binary is found
// under whichever platform package is installed (Windows and POSIX names alike), a sibling package that
// shares the prefix but ships no binary is skipped, and a missing scope directory — the ordinary
// `npm run dev` case — yields undefined so the SDK keeps its own resolution.

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { findClaudeExecutable } from '../claude-executable'

interface Fixture {
  readonly name: string
  readonly binaries: readonly string[]
}

// Each case owns a fresh scope directory and removes it afterwards, so no test observes another's
// packages and none has to share mutable state.
const withScope = (packages: readonly Fixture[], assert: (scope: string) => void): void => {
  const scope = mkdtempSync(join(tmpdir(), 'pluma-claude-exe-'))
  try {
    packages.forEach((fixture) => {
      mkdirSync(join(scope, fixture.name), { recursive: true })
      fixture.binaries.forEach((binary) => writeFileSync(join(scope, fixture.name, binary), ''))
    })
    assert(scope)
  } finally {
    rmSync(scope, { recursive: true, force: true })
  }
}

describe('findClaudeExecutable', () => {
  it('finds the Windows binary in the installed platform package', () => {
    withScope([{ name: 'claude-agent-sdk-win32-x64', binaries: ['claude.exe'] }], (scope) => {
      expect(findClaudeExecutable(scope)).toBe(
        join(scope, 'claude-agent-sdk-win32-x64', 'claude.exe')
      )
    })
  })

  it('finds the POSIX binary, whose name has no extension', () => {
    withScope([{ name: 'claude-agent-sdk-darwin-arm64', binaries: ['claude'] }], (scope) => {
      expect(findClaudeExecutable(scope)).toBe(
        join(scope, 'claude-agent-sdk-darwin-arm64', 'claude')
      )
    })
  })

  it('skips a prefix-sharing package that ships no binary', () => {
    withScope(
      [
        { name: 'claude-agent-sdk-typescript', binaries: [] },
        { name: 'claude-agent-sdk-linux-x64-musl', binaries: ['claude'] }
      ],
      (scope) => {
        expect(findClaudeExecutable(scope)).toBe(
          join(scope, 'claude-agent-sdk-linux-x64-musl', 'claude')
        )
      }
    )
  })

  it('ignores the sdk package itself, which shares no prefix boundary', () => {
    withScope([{ name: 'claude-agent-sdk', binaries: ['sdk.mjs'] }], (scope) => {
      expect(findClaudeExecutable(scope)).toBeUndefined()
    })
  })

  it('yields undefined when the unpacked directory does not exist', () => {
    withScope([], (scope) => {
      expect(findClaudeExecutable(join(scope, 'missing'))).toBeUndefined()
    })
  })
})
