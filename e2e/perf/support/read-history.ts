// Loads the prior runs the current run is judged against: every validated runs/*.json except the one
// just written (passed as excludeFile). Cross-machine filtering happens later in the comparison; here we
// simply return all valid history. Missing folder or unreadable files degrade to an empty history.

import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { isRunRecord } from './is-run-record'
import { perfPaths } from './perf-paths'
import type { RunRecord } from './assemble-run'

const readHistory = async (excludeFile: string): Promise<readonly RunRecord[]> => {
  const entries = await readdir(perfPaths.runs).catch(() => [])
  const files = entries.filter((name) => name.endsWith('.json') && name !== excludeFile)
  const parsed = await Promise.all(
    files.map(async (name): Promise<unknown> => {
      const text = await readFile(join(perfPaths.runs, name), 'utf8')
      return JSON.parse(text)
    })
  )
  return parsed.filter(isRunRecord)
}

export { readHistory }
