// The filename for a consolidated run, encoding when it ran and which commit it measured so the runs
// folder reads as a chronological, traceable history. Colons and dots from the ISO timestamp are not
// legal in filenames on Windows, so they are flattened to dashes.

import type { RunContext } from './run-context'

const runFileName = (context: RunContext): string =>
  `${context.timestamp.replace(/[:.]/g, '-')}-${context.commit}.json`

export { runFileName }
