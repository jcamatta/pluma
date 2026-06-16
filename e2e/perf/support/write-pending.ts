// A scenario calls this once it has measured its iterations: it drops the result as one JSON file in the
// pending area, keyed by scenario name. Specs run sequentially (workers: 1), so each writes its own file
// without contention; the globalTeardown later collects every pending piece into one consolidated run.

import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { perfPaths } from './perf-paths'
import type { ScenarioResult } from './scenario-result'

const writePending = async (result: ScenarioResult): Promise<void> => {
  await mkdir(perfPaths.pending, { recursive: true })
  await writeFile(
    join(perfPaths.pending, `${result.scenario}.json`),
    JSON.stringify(result, null, 2)
  )
}

export { writePending }
