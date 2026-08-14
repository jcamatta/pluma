// Action: locate the Claude binary that ships with the app, for packaged builds only.
//
// The SDK resolves its executable through module resolution, which in a packaged build lands inside
// `app.asar`. An asar is a virtual archive: a path inside it can be read, but never executed, so the
// spawn fails and every run dies before it starts. electron-builder unpacks the SDK's platform package
// (see `asarUnpack`), and this finds that unpacked copy.
//
// The platform package is found by scanning rather than by reconstructing its name from
// platform/arch/libc: exactly one is ever installed (npm resolves only the host's optional dependency),
// and the binary's own name differs per platform (`claude.exe` vs `claude`). Scanning is both shorter
// and correct on all three OSes. `claude-agent-sdk-typescript` shares the prefix but holds no binary, so
// candidates are confirmed by existence rather than by name.
//
// Outside a packaged build the unpacked directory does not exist, so this yields undefined and the SDK
// keeps its own resolution — `npm run dev` is untouched.

import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const PACKAGE_PREFIX = 'claude-agent-sdk-'
const BINARY_NAMES = ['claude.exe', 'claude'] as const
const UNPACKED_SCOPE = ['app.asar.unpacked', 'node_modules', '@anthropic-ai'] as const

const entriesIn = (dir: string): readonly string[] => (existsSync(dir) ? readdirSync(dir) : [])

// The scope directory is a parameter so the lookup can be exercised against a temporary fixture
// instead of a real packaged app.
const findClaudeExecutable = (scopeDir: string): string | undefined =>
  entriesIn(scopeDir)
    .filter((name) => name.startsWith(PACKAGE_PREFIX))
    .flatMap((name) => BINARY_NAMES.map((binary) => join(scopeDir, name, binary)))
    .find((candidate) => existsSync(candidate))

// `resourcesPath` is Electron's, not Node's: it is absent when this module is imported by a plain Node
// process, as the unit suite does. Its absence is also exactly the not-packaged answer.
const packagedClaudeExecutable = (): string | undefined =>
  typeof process.resourcesPath === 'string'
    ? findClaudeExecutable(join(process.resourcesPath, ...UNPACKED_SCOPE))
    : undefined

export { findClaudeExecutable, packagedClaudeExecutable }
