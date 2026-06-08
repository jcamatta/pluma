// The e2e existence gate, run as a fast unit test (no Electron launch) so it rides the standard
// `npm run test` / pre-commit gate. It reads every spec's `@e2e` header tags and fails if any feature
// or operation in coverage-manifest.ts is unclaimed. This is what "forces e2e to exist": add a feature
// or an IPC channel, add its id to the manifest, and this test goes red until a real-app *.e2e.ts spec
// claims it. It proves a claiming spec exists; the spec, driving the real desktop app, validates the
// behavior.

import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { FEATURES, OPERATIONS } from '../coverage-manifest'

const E2E_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')
const TAG = /@e2e\s+(.+)/g

const specFiles = async (): Promise<readonly string[]> => {
  const entries = await readdir(E2E_DIR, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.e2e.ts'))
    .map((entry) => join(E2E_DIR, entry.name))
}

const claimedIds = async (): Promise<ReadonlySet<string>> => {
  const files = await specFiles()
  const contents = await Promise.all(files.map((file) => readFile(file, 'utf8')))
  const ids = contents.flatMap((text) =>
    [...text.matchAll(TAG)].flatMap((match) => match[1].trim().split(/\s+/))
  )
  return new Set(ids)
}

describe('e2e coverage audit', () => {
  test('every manifest feature is claimed by a spec', async () => {
    const claimed = await claimedIds()
    const missing = FEATURES.filter((feature) => !claimed.has(`feature:${feature}`))
    expect(
      missing,
      `features with no e2e spec claiming "feature:<id>": ${missing.join(', ')}`
    ).toEqual([])
  })

  test('every manifest operation is claimed by a spec', async () => {
    const claimed = await claimedIds()
    const missing = OPERATIONS.filter((operation) => !claimed.has(`operation:${operation}`))
    expect(
      missing,
      `operations with no e2e spec claiming "operation:<id>": ${missing.join(', ')}`
    ).toEqual([])
  })
})
