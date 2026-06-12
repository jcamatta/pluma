import { describe, expect, it } from 'vitest'
import { renderReport } from '../render-report'
import type { RunRecord } from '../assemble-run'
import type { MetricComparison } from '../compare-baseline'

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

const comparison: MetricComparison = {
  scenario: 'cold-start',
  metric: 'launch-to-interactive',
  unit: 'ms',
  current: 1025,
  baseline: 1000,
  deltaPct: 2.5,
  regressed: false,
  budget: null,
  withinBudget: null
}

describe('renderReport', () => {
  it('renders provenance from the run context', () => {
    const md = renderReport(run, [])
    expect(md).toContain('# Performance report')
    expect(md).toContain('- Commit: `abc1234`')
    expect(md).toContain('- Machine: box')
    expect(md).toContain('- Generated: 2026-06-12T19:20:00.000Z')
  })

  it('shows dashes for baseline columns when there is no comparison', () => {
    const md = renderReport(run, [])
    expect(md).toContain('## cold-start')
    expect(md).toContain(
      '| launch-to-interactive | 1025.00 ms | 1047.50 ms | 1000.00 ms | 1050.00 ms | 2 | — | — | — |'
    )
  })

  it('fills baseline, delta and verdict from a matching comparison', () => {
    const md = renderReport(run, [comparison])
    expect(md).toContain(
      '| launch-to-interactive | 1025.00 ms | 1047.50 ms | 1000.00 ms | 1050.00 ms | 2 | 1000.00 ms | +2.5% | ok |'
    )
  })
})
