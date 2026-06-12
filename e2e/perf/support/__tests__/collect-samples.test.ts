import { describe, expect, it } from 'vitest'
import { collectSamples } from '../collect-samples'

describe('collectSamples', () => {
  it('returns one sample per iteration, in order', async () => {
    const samples = await collectSamples(3, async (i) => i * 10)
    expect(samples).toEqual([0, 10, 20])
  })

  it('returns no samples for a zero count', async () => {
    expect(await collectSamples(0, async () => 1)).toEqual([])
  })

  it('runs strictly in sequence', async () => {
    const order: number[] = []
    await collectSamples(3, async (i) => {
      order.push(i)
      return i
    })
    expect(order).toEqual([0, 1, 2])
  })
})
