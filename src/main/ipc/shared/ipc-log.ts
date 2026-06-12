// The reusable observability wrapper for an IPC handler's effect. It logs "started" before the work,
// "succeeded" after it, and "failed" with the rendered cause on any failure, with every line carrying
// the channel (and any safe scalar annotations) and the elapsed time. It also opens a tracing span per
// channel against the default tracer, so wiring a real Tracer later lights up traces with no handler
// change. Annotate the channel plus safe scalars only — never file contents, message bodies, or keys.

import * as Cause from 'effect/Cause'
import * as Effect from 'effect/Effect'

type Annotations = Record<string, string | number | boolean>

interface IpcLogInput<A, E, R> {
  readonly channel: string
  readonly annotations?: Annotations
  readonly effect: Effect.Effect<A, E, R>
}

const withIpcLog = <A, E, R>(input: IpcLogInput<A, E, R>): Effect.Effect<A, E, R> =>
  Effect.logInfo('started').pipe(
    Effect.zipRight(
      input.effect.pipe(
        Effect.tap(() => Effect.logInfo('succeeded')),
        Effect.tapErrorCause((cause) => Effect.logError('failed', Cause.pretty(cause)))
      )
    ),
    Effect.annotateLogs({ channel: input.channel, ...input.annotations }),
    Effect.withLogSpan('ipc'),
    Effect.withSpan(`ipc.${input.channel}`)
  )

export { withIpcLog }
export type { Annotations, IpcLogInput }
