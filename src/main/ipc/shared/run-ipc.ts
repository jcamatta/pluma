// Runs a use-case effect for a fallible IPC endpoint: wraps it with observability, runs it on the shared
// runtime, and folds the Exit into the plain Result that crosses IPC. The per-channel error projection
// stays with the caller (onError maps a typed failure to its wire shape; onDefect supplies the fallback
// for an unexpected defect), since that mapping is part of each channel's IPC contract. Never throws.

import * as Cause from 'effect/Cause'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as Option from 'effect/Option'
import type { Result } from '../../../shared/ipc/ipc-result'
import { mainRuntime } from '../../runtime/main-runtime'
import { withIpcLog } from './ipc-log'
import type { Annotations } from './ipc-log'

interface RunIpcOptions<A, E, PlainError extends { _tag: string }> {
  readonly channel: string
  readonly effect: Effect.Effect<A, E>
  readonly onError: (error: E) => PlainError
  readonly onDefect: () => PlainError
  readonly annotations?: Annotations
}

const foldExit =
  <A, E, PlainError extends { _tag: string }>(options: RunIpcOptions<A, E, PlainError>) =>
  (exit: Exit.Exit<A, E>): Result<A, PlainError> =>
    Exit.match(exit, {
      onSuccess: (value) => ({ ok: true, value }),
      onFailure: (cause) =>
        Option.match(Cause.failureOption(cause), {
          onNone: () => ({ ok: false, error: options.onDefect() }),
          onSome: (error) => ({ ok: false, error: options.onError(error) })
        })
    })

const runIpc = <A, E, PlainError extends { _tag: string }>(
  options: RunIpcOptions<A, E, PlainError>
): Promise<Result<A, PlainError>> =>
  mainRuntime
    .runPromiseExit(
      withIpcLog({
        channel: options.channel,
        annotations: options.annotations,
        effect: options.effect
      })
    )
    .then(foldExit(options))

export { runIpc }
export type { RunIpcOptions }
