// Tests the observability wrapper: it logs started/succeeded around a successful effect and started/failed
// around a failing one, with every line annotated by the channel. We capture log lines through a custom
// Logger that replaces the default one, so the assertions never depend on console output.

import * as Effect from 'effect/Effect'
import * as HashMap from 'effect/HashMap'
import * as Logger from 'effect/Logger'
import * as Option from 'effect/Option'
import { describe, expect, it } from 'vitest'
import { withIpcLog } from '../ipc-log'

interface Captured {
  readonly message: unknown
  readonly channel: unknown
}

const captureLogs = async (
  effect: Effect.Effect<unknown, unknown>
): Promise<readonly Captured[]> => {
  const lines: Captured[] = []
  const logger = Logger.make((options) => {
    lines.push({
      message: options.message,
      channel: Option.getOrNull(HashMap.get(options.annotations, 'channel'))
    })
  })
  await Effect.runPromise(
    Effect.ignore(effect).pipe(Effect.provide(Logger.replace(Logger.defaultLogger, logger)))
  )
  return lines
}

const messagesOf = (lines: readonly Captured[]): readonly unknown[] =>
  lines.flatMap((line) => (Array.isArray(line.message) ? line.message : [line.message]))

describe('withIpcLog', () => {
  it('logs started then succeeded, annotated with the channel, on success', async () => {
    const lines = await captureLogs(withIpcLog({ channel: 'sample:do', effect: Effect.succeed(1) }))

    expect(messagesOf(lines)).toContain('started')
    expect(messagesOf(lines)).toContain('succeeded')
    expect(lines.every((line) => line.channel === 'sample:do')).toBe(true)
  })

  it('logs failed when the effect fails', async () => {
    const lines = await captureLogs(
      withIpcLog({ channel: 'sample:do', effect: Effect.fail('nope') })
    )

    expect(messagesOf(lines)).toContain('started')
    expect(messagesOf(lines)).toContain('failed')
  })
})
