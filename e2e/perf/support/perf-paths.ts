// Filesystem locations for perf artifacts, all under a single gitignored `perf-results/` at the repo
// root (resolved from this file, three levels up: support -> perf -> e2e -> root). Scenarios drop their
// pieces in `.pending/` during a run; the teardown consolidates them into a timestamped file under
// `runs/` and renders `report.md`. Nothing here is ever committed.

import { join } from 'node:path'

const root = join(__dirname, '..', '..', '..', 'perf-results')

const perfPaths = {
  root,
  pending: join(root, '.pending'),
  runs: join(root, 'runs'),
  report: join(root, 'report.md')
} as const

export { perfPaths }
