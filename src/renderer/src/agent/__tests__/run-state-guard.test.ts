// run-state-guard: the field guards accept the wire values and reject strays; toRunState keeps only the
// valid model/effort fields and yields undefined when nothing usable is present.

import { describe, expect, it } from 'vitest'
import { isEffortLevel, isModel, toRunState } from '../run-state-guard'

describe('isModel', () => {
  it('accepts the two wire models and rejects anything else', () => {
    expect(isModel('claude-opus-4-8')).toBe(true)
    expect(isModel('claude-sonnet-4-6')).toBe(true)
    expect(isModel('gpt-4')).toBe(false)
    expect(isModel(undefined)).toBe(false)
  })
})

describe('isEffortLevel', () => {
  it('accepts the wire effort levels and rejects anything else', () => {
    expect(isEffortLevel('low')).toBe(true)
    expect(isEffortLevel('medium')).toBe(true)
    expect(isEffortLevel('high')).toBe(true)
    expect(isEffortLevel('turbo')).toBe(false)
    expect(isEffortLevel(7)).toBe(false)
  })
})

describe('toRunState', () => {
  it('keeps valid model and effort fields', () => {
    expect(toRunState({ model: 'claude-sonnet-4-6', effort: 'high' })).toEqual({
      model: 'claude-sonnet-4-6',
      effort: 'high'
    })
  })

  it('drops invalid fields and keeps the valid one', () => {
    expect(toRunState({ model: 'nope', effort: 'low' })).toEqual({ effort: 'low' })
  })

  it('returns undefined for a non-object or an all-invalid state', () => {
    expect(toRunState(null)).toBeUndefined()
    expect(toRunState('medium')).toBeUndefined()
    expect(toRunState({ model: 'nope', effort: 'turbo' })).toBeUndefined()
  })
})
