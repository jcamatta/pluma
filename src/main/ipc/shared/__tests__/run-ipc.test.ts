// Tests the runIpc / runIpcAck contract: the Exit is folded into the plain Result the renderer expects.
// Success carries the value; a typed tagged failure is projected by onError; an unexpected defect falls
// back to onDefect; and a no-fail ack always resolves ok. Logging side effects are covered in ipc-log.test.

import * as Data from 'effect/Data'
import * as Effect from 'effect/Effect'
import { describe, expect, it } from 'vitest'
import { runIpc } from '../run-ipc'
import { runIpcAck } from '../run-ipc-ack'

class SampleFailed extends Data.TaggedError('SampleFailed')<{ readonly path: string }> {}

const project = (error: SampleFailed): { _tag: 'SampleFailed'; path: string } => ({
  _tag: error._tag,
  path: error.path
})

const onDefect = (): { _tag: 'SampleFailed'; path: string } => ({ _tag: 'SampleFailed', path: '' })

describe('runIpc', () => {
  it('folds success into ok:true with the value', async () => {
    const result = await runIpc({
      channel: 'sample:do',
      effect: Effect.succeed(42),
      onError: project,
      onDefect
    })

    expect(result).toStrictEqual({ ok: true, value: 42 })
  })

  it('projects a typed failure with onError', async () => {
    const result = await runIpc({
      channel: 'sample:do',
      effect: Effect.fail(new SampleFailed({ path: '/x.md' })),
      onError: project,
      onDefect
    })

    expect(result).toStrictEqual({ ok: false, error: { _tag: 'SampleFailed', path: '/x.md' } })
  })

  it('falls back to onDefect on an unexpected defect', async () => {
    const result = await runIpc({
      channel: 'sample:do',
      effect: Effect.die(new Error('boom')),
      onError: project,
      onDefect
    })

    expect(result).toStrictEqual({ ok: false, error: { _tag: 'SampleFailed', path: '' } })
  })
})

describe('runIpcAck', () => {
  it('always resolves ok:true with a null value', async () => {
    const result = await runIpcAck({ channel: 'sample:ack', effect: Effect.void })

    expect(result).toStrictEqual({ ok: true, value: null })
  })
})
