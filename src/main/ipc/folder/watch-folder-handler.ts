// IPC endpoint for watching a folder. Starts a recursive watcher through the FolderWatcher port and
// forwards each FileEvent via the send callback. The watch+forward effect is forked onto the app scope,
// so its watcher resources live until that scope is closed on quit. The FileEvent stream cannot cross
// IPC, so the endpoint returns a plain ack Result reporting only whether the initial subscribe
// succeeded. Never throws across IPC.

import * as Deferred from 'effect/Deferred'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as Scope from 'effect/Scope'
import * as Stream from 'effect/Stream'
import * as NodeContext from '@effect/platform-node/NodeContext'
import type { FolderChange } from '../../../shared/ipc/ipc-event-contract/folder'
import type { FolderWatchError } from '../../../shared/ipc/ipc-contract/folder'
import type { Result } from '../../../shared/ipc/ipc-result'
import { FolderWatchFailed } from '../../application/folder/error/folder-watch-failed'
import { FolderWatcher } from '../../application/folder/port/folder-watcher.port'
import type { FolderWatcherPort } from '../../application/folder/port/folder-watcher.port'
import { ParcelFolderWatcherLive } from '../../adapters/folder/parcel-folder-watcher'

export interface WatchFolderArgs {
  readonly path: string
  readonly scope: Scope.Scope
  readonly send: (event: FolderChange) => void
}

interface WatchForward {
  readonly path: string
  readonly send: (event: FolderChange) => void
  readonly ready: Deferred.Deferred<void, FolderWatchFailed>
}

const watchAndForward = (
  watch: WatchForward
): Effect.Effect<void, never, FolderWatcherPort | Scope.Scope> =>
  Effect.gen(function* () {
    const watcher = yield* FolderWatcher
    const stream = yield* watcher.watch(watch.path)
    yield* Deferred.succeed(watch.ready, undefined)
    yield* Stream.runForEach(stream, (event) => Effect.sync(() => watch.send(event)))
  }).pipe(Effect.catchAll((error) => Deferred.fail(watch.ready, error)))

export const handleWatchFolder = (
  args: WatchFolderArgs
): Promise<Result<null, FolderWatchError>> => {
  const program = Effect.gen(function* () {
    const ready = yield* Deferred.make<void, FolderWatchFailed>()
    Effect.runFork(
      watchAndForward({ path: args.path, send: args.send, ready }).pipe(
        Effect.provide(ParcelFolderWatcherLive),
        Effect.provide(NodeContext.layer),
        Effect.provideService(Scope.Scope, args.scope)
      )
    )
    return yield* Deferred.await(ready)
  })

  return Effect.runPromiseExit(program).then(
    (exit): Result<null, FolderWatchError> =>
      Exit.match(exit, {
        onSuccess: () => ({ ok: true, value: null }),
        onFailure: () => ({ ok: false, error: { _tag: 'FolderWatchFailed', path: args.path } })
      })
  )
}
