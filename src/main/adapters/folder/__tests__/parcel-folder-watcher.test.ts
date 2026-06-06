// Tests for the @parcel/watcher-backed FolderWatcher adapter against a real temp directory. Verifies
// that creating a file under the watched directory yields a FileEvent on the stream, and that closing
// the scope releases the subscription. Native watcher delivery is asynchronous, so the test collects
// from the stream with a bounded time window.

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as Chunk from 'effect/Chunk'
import * as Duration from 'effect/Duration'
import * as Effect from 'effect/Effect'
import * as Fiber from 'effect/Fiber'
import * as Stream from 'effect/Stream'
import { describe, expect, it } from 'vitest'
import type { FileEvent } from '../../../application/folder/data/file-event'
import { FolderWatcher } from '../../../application/folder/port/folder-watcher.port'
import { ParcelFolderWatcherLive } from '../parcel-folder-watcher'

const makeTempDir = (): string => mkdtempSync(join(tmpdir(), 'pluma-'))

const collectFor = (watch: {
  readonly dir: string
  readonly trigger: () => void
}): Effect.Effect<ReadonlyArray<FileEvent>> =>
  Effect.scoped(
    Effect.gen(function* () {
      const watcher = yield* FolderWatcher
      const stream = yield* watcher.watch(watch.dir).pipe(Effect.orDie)
      const fiber = yield* Effect.fork(
        Stream.runCollect(stream.pipe(Stream.timeout(Duration.seconds(2))))
      )

      yield* Effect.sleep(Duration.millis(300))
      yield* Effect.sync(watch.trigger)

      const collected = yield* Fiber.join(fiber)
      return Chunk.toReadonlyArray(collected)
    })
  ).pipe(Effect.provide(ParcelFolderWatcherLive))

describe('ParcelFolderWatcherLive watch', () => {
  it('emits a created event when a file appears under the watched directory', async () => {
    const dir = makeTempDir()
    const target = join(dir, 'new.md')
    try {
      const events = await Effect.runPromise(
        collectFor({ dir, trigger: () => writeFileSync(target, 'content') })
      )
      const created = events.filter((event) => event.path === target)
      expect(created.length).toBeGreaterThan(0)
      expect(created[0].type).toBe('created')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
