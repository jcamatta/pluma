// The provenance stamped onto every run: which commit was measured, the app version, the machine, and
// when. The machine matters most — runs are only comparable against prior runs from the *same* machine,
// since one developer's box is a biased sample of what users experience. Reads git and package.json
// directly (an action, run once per suite in the teardown).

import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { hostname } from 'node:os'
import { join } from 'node:path'

type RunContext = {
  readonly commit: string
  readonly version: string
  readonly machine: string
  readonly timestamp: string
}

const hasVersion = (value: unknown): value is { readonly version: string } =>
  typeof value === 'object' &&
  value !== null &&
  'version' in value &&
  typeof value.version === 'string'

const readVersion = (): string => {
  const parsed: unknown = JSON.parse(
    readFileSync(join(__dirname, '..', '..', '..', 'package.json'), 'utf8')
  )
  return hasVersion(parsed) ? parsed.version : 'unknown'
}

const runContext = (): RunContext => ({
  commit: execSync('git rev-parse --short HEAD').toString().trim(),
  version: readVersion(),
  machine: hostname(),
  timestamp: new Date().toISOString()
})

export { runContext, type RunContext }
