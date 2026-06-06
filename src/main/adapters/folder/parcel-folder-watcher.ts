// FolderWatcher adapter backed by @parcel/watcher. The only place that touches the native watcher.
// Subscribes recursively to the target directory and publishes each raw event onto a PubSub, exposed
// as a FileEvent stream. Both the PubSub and the subscription are acquired with acquireRelease, so
// closing the ambient Scope shuts down the PubSub and unsubscribes the watcher, freeing OS resources.

import parcelWatcher from '@parcel/watcher'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as PubSub from 'effect/PubSub'
import * as Stream from 'effect/Stream'
import type { FileEvent } from '../../application/folder/data/file-event'
import { FolderWatchFailed } from '../../application/folder/error/folder-watch-failed'
import { FolderWatcher } from '../../application/folder/port/folder-watcher.port'

const toFileEvent = (event: parcelWatcher.Event): FileEvent => {
  switch (event.type) {
    case 'create':
      return { type: 'created', path: event.path }
    case 'update':
      return { type: 'updated', path: event.path }
    case 'delete':
      return { type: 'deleted', path: event.path }
  }
}

const make = FolderWatcher.of({
  watch: (path) =>
    Effect.gen(function* () {
      const pubsub = yield* Effect.acquireRelease(PubSub.unbounded<FileEvent>(), (current) =>
        PubSub.shutdown(current)
      )

      yield* Effect.acquireRelease(
        Effect.tryPromise({
          try: () =>
            parcelWatcher.subscribe(path, (error, events) => {
              if (error) {
                return
              }
              for (const event of events) {
                Effect.runFork(PubSub.publish(pubsub, toFileEvent(event)))
              }
            }),
          catch: () => new FolderWatchFailed({ path })
        }),
        (subscription) => Effect.promise(() => subscription.unsubscribe())
      )

      return Stream.fromPubSub(pubsub)
    })
})

export const ParcelFolderWatcherLive = Layer.succeed(FolderWatcher, make)
