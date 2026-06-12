import { describe, expect, it } from 'vitest'
import { runFileName } from '../run-filename'

describe('runFileName', () => {
  it('flattens the ISO timestamp colons and dots and appends the commit', () => {
    const name = runFileName({
      commit: 'abc1234',
      version: '1.0.0',
      machine: 'box',
      timestamp: '2026-06-12T19:20:00.000Z'
    })
    expect(name).toBe('2026-06-12T19-20-00-000Z-abc1234.json')
  })

  it('contains no characters illegal in a filename', () => {
    const name = runFileName({
      commit: 'deadbee',
      version: '1.0.0',
      machine: 'box',
      timestamp: '2026-01-02T03:04:05.678Z'
    })
    expect(name).not.toMatch(/[:.](?!json)/)
  })
})
