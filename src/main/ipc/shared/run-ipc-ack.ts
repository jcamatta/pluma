// Runs a use-case effect for a no-fail IPC endpoint (one whose Result error channel is never): the work
// always acknowledges with ok. It still gets the same observability — started/succeeded/failed logs and
// a span — so even an unexpected defect is recorded before it surfaces. Use this for the ack channels
// (abort, tool-result) that the renderer fires and only needs confirmation for.

import type * as Effect from 'effect/Effect'
import type { Result } from '../../../shared/ipc/ipc-result'
import { mainRuntime } from '../../runtime/main-runtime'
import { withIpcLog } from './ipc-log'
import type { Annotations } from './ipc-log'

interface RunIpcAckOptions<A> {
  readonly channel: string
  readonly effect: Effect.Effect<A>
  readonly annotations?: Annotations
}

const runIpcAck = <A>(options: RunIpcAckOptions<A>): Promise<Result<null, never>> =>
  mainRuntime
    .runPromise(
      withIpcLog({
        channel: options.channel,
        annotations: options.annotations,
        effect: options.effect
      })
    )
    .then(() => ({ ok: true, value: null }))

export { runIpcAck }
export type { RunIpcAckOptions }
