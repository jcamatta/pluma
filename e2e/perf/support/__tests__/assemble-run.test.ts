import { describe, expect, it } from 'vitest'
import { assembleRun } from '../assemble-run'
import type { RunContext } from '../run-context'
import type { ScenarioResult } from '../scenario-result'

const context: RunContext = {
  commit: 'abc1234',
  version: '1.0.0',
  machine: 'box',
  timestamp: '2026-06-12T19:20:00.000Z'
}

const scenario = (name: string): ScenarioResult => ({
  scenario: name,
  iterations: 1,
  metrics: [{ name: 'm', unit: 'ms', samples: [1] }]
})

describe('assembleRun', () => {
  it('keeps the context and sorts scenarios by name', () => {
    const run = assembleRun(context, [scenario('typing'), scenario('cold-start')])
    expect(run.context).toBe(context)
    expect(run.scenarios.map((s) => s.scenario)).toEqual(['cold-start', 'typing'])
  })

  it('does not mutate the input array', () => {
    const input = [scenario('b'), scenario('a')]
    assembleRun(context, input)
    expect(input.map((s) => s.scenario)).toEqual(['b', 'a'])
  })
})
