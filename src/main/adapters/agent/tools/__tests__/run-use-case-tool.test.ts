import * as Data from 'effect/Data'
import * as Effect from 'effect/Effect'
import { describe, expect, it } from 'vitest'
import { runUseCaseTool } from '../run-use-case-tool'

class SampleError extends Data.TaggedError('SampleError')<{ readonly path: string }> {}

describe('runUseCaseTool', () => {
  it('folds a success into a text output', async () => {
    const result = await Effect.runPromise(
      runUseCaseTool({
        effect: Effect.succeed('hello'),
        toOutput: (value) => ({ type: 'text', text: value }),
        fallback: 'unexpected_error'
      })
    )

    expect(result).toEqual({ ok: true, output: { type: 'text', text: 'hello' } })
  })

  it('folds a success into a json output', async () => {
    const result = await Effect.runPromise(
      runUseCaseTool({
        effect: Effect.succeed({ count: 2 }),
        toOutput: (value) => ({ type: 'json', value }),
        fallback: 'unexpected_error'
      })
    )

    expect(result).toEqual({ ok: true, output: { type: 'json', value: { count: 2 } } })
  })

  it('folds a typed failure into its tag', async () => {
    const result = await Effect.runPromise(
      runUseCaseTool({
        effect: Effect.fail(new SampleError({ path: '/notes/a.md' })),
        toOutput: (value: never) => ({ type: 'text', text: value }),
        fallback: 'unexpected_error'
      })
    )

    expect(result).toEqual({ ok: false, error: 'SampleError' })
  })

  it('folds a defect into the fallback string', async () => {
    const result = await Effect.runPromise(
      runUseCaseTool({
        effect: Effect.die(new Error('boom')),
        toOutput: (value: never) => ({ type: 'text', text: value }),
        fallback: 'unexpected_error'
      })
    )

    expect(result).toEqual({ ok: false, error: 'unexpected_error' })
  })
})
