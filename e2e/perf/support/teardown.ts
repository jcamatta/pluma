// Playwright globalTeardown for the perf suite: after every scenario has dropped its pending piece, this
// collects them, stamps the run with its context, writes one consolidated run file under runs/, and
// clears the pending area. With no valid pending pieces (e.g. all scenarios failed before measuring) it
// writes nothing. Rendering the human-readable report is layered on next.

import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { assembleRun } from './assemble-run'
import { isScenarioResult } from './is-scenario-result'
import { perfPaths } from './perf-paths'
import { runContext } from './run-context'
import { runFileName } from './run-filename'
import type { ScenarioResult } from './scenario-result'

const readPending = async (): Promise<readonly ScenarioResult[]> => {
  const entries = await readdir(perfPaths.pending).catch(() => [])
  const files = entries.filter((name) => name.endsWith('.json'))
  const parsed = await Promise.all(
    files.map(async (name): Promise<unknown> => {
      const text = await readFile(join(perfPaths.pending, name), 'utf8')
      return JSON.parse(text)
    })
  )
  return parsed.filter(isScenarioResult)
}

const globalTeardown = async (): Promise<void> => {
  const scenarios = await readPending()
  if (scenarios.length === 0) return
  const run = assembleRun(runContext(), scenarios)
  await mkdir(perfPaths.runs, { recursive: true })
  await writeFile(join(perfPaths.runs, runFileName(run.context)), JSON.stringify(run, null, 2))
  await rm(perfPaths.pending, { recursive: true, force: true })
}

export default globalTeardown
