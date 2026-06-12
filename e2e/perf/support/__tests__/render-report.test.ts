import { describe, expect, it } from 'vitest'
import { renderReport } from '../render-report'
import type { RunRecord } from '../assemble-run'

const run: RunRecord = {
  context: {
    commit: 'abc1234',
    version: '1.0.0',
    machine: 'box',
    timestamp: '2026-06-12T19:20:00.000Z'
  },
  scenarios: [
    {
      scenario: 'cold-start',
      iterations: 2,
      metrics: [{ name: 'launch-to-interactive', unit: 'ms', samples: [1000, 1050] }]
    }
  ]
}

describe('renderReport', () => {
  it('renders provenance from the run context', () => {
    const md = renderReport(run)
    expect(md).toContain('# Performance report')
    expect(md).toContain('- Commit: `abc1234`')
    expect(md).toContain('- Machine: box')
    expect(md).toContain('- Generated: 2026-06-12T19:20:00.000Z')
  })

  it('renders one section per scenario with a summarized metric row', () => {
    const md = renderReport(run)
    expect(md).toContain('## cold-start')
    expect(md).toContain(
      '| launch-to-interactive | 1025.00 ms | 1047.50 ms | 1000.00 ms | 1050.00 ms | 2 |'
    )
  })
})
