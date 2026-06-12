import { describe, expect, it } from 'vitest'
import { verdictLabel } from '../verdict-label'
import type { MetricComparison } from '../compare-baseline'

const base: MetricComparison = {
  scenario: 's',
  metric: 'm',
  unit: 'ms',
  current: 10,
  baseline: 10,
  deltaPct: 0,
  regressed: false,
  budget: null,
  withinBudget: null
}

describe('verdictLabel', () => {
  it('reports a regression first', () => {
    expect(verdictLabel({ ...base, regressed: true })).toBe('REGRESSED')
  })

  it('reports an over-budget breach when not regressed', () => {
    expect(verdictLabel({ ...base, budget: 50, withinBudget: false })).toBe('OVER BUDGET')
  })

  it('reports baseline on a first run with no baseline', () => {
    expect(verdictLabel({ ...base, baseline: null, deltaPct: null })).toBe('baseline')
  })

  it('reports ok otherwise', () => {
    expect(verdictLabel(base)).toBe('ok')
  })
})
