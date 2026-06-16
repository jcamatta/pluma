import { describe, expect, it } from 'vitest'
import { compareRun } from '../compare-baseline'
import type { RunRecord } from '../assemble-run'

const run = (machine: string, sample: number): RunRecord => ({
  context: { commit: 'c', version: '1.0.0', machine, timestamp: 't' },
  scenarios: [
    {
      scenario: 'cold-start',
      iterations: 1,
      metrics: [{ name: 'launch', unit: 'ms', samples: [sample] }]
    }
  ]
})

describe('compareRun', () => {
  it('reports a null baseline and no regression on the first run', () => {
    const [c] = compareRun(run('box', 1000), [])
    expect(c.baseline).toBeNull()
    expect(c.deltaPct).toBeNull()
    expect(c.regressed).toBe(false)
  })

  it('computes baseline and delta from same-machine history', () => {
    const [c] = compareRun(run('box', 110), [run('box', 100), run('box', 100)])
    expect(c.baseline).toBe(100)
    expect(c.deltaPct).toBeCloseTo(10, 10)
    expect(c.regressed).toBe(false)
  })

  it('flags a regression above the 20% threshold', () => {
    const [c] = compareRun(run('box', 130), [run('box', 100)])
    expect(c.deltaPct).toBeCloseTo(30, 10)
    expect(c.regressed).toBe(true)
  })

  it('ignores history from other machines', () => {
    const [c] = compareRun(run('box', 110), [run('laptop', 100)])
    expect(c.baseline).toBeNull()
  })

  it('reports a perception budget verdict for keystroke-to-paint', () => {
    const fast: RunRecord = {
      context: { commit: 'c', version: '1.0.0', machine: 'box', timestamp: 't' },
      scenarios: [
        {
          scenario: 'typing-latency',
          iterations: 1,
          metrics: [{ name: 'keystroke-to-paint', unit: 'ms', samples: [30] }]
        }
      ]
    }
    const [c] = compareRun(fast, [])
    expect(c.budget).toBe(50)
    expect(c.withinBudget).toBe(true)
  })
})
