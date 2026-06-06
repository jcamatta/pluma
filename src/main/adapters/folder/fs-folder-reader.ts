// FolderReader adapter backed by the platform FileSystem. The only read place that touches real disk
// I/O. Maps filesystem state to the domain's typed errors: a target that is not an existing directory
// -> FolderNotFound, any other read failure -> FolderReadFailed. Lists one level deep; each child is
// stat'd to classify it as a file or directory. Anything that is neither (or cannot be stat'd) is
// treated as a file.

import { FileSystem } from '@effect/platform/FileSystem'
import { Path } from '@effect/platform/Path'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import type { FolderEntry } from '../../application/folder/data/entry'
import { FolderNotFound } from '../../application/folder/error/folder-not-found'
import { FolderReadFailed } from '../../application/folder/error/folder-read-failed'
import { FolderReader } from '../../application/folder/port/folder-reader.port'

const make = Effect.gen(function* () {
  const fs = yield* FileSystem
  const path = yield* Path

  const classify = (target: string, name: string): Effect.Effect<FolderEntry> =>
    fs.stat(path.join(target, name)).pipe(
      Effect.map(
        (child): FolderEntry => ({
          name,
          type: child.type === 'Directory' ? 'directory' : 'file'
        })
      ),
      Effect.orElseSucceed((): FolderEntry => ({ name, type: 'file' }))
    )

  const listFolder = (
    target: string
  ): Effect.Effect<ReadonlyArray<FolderEntry>, FolderNotFound | FolderReadFailed> =>
    Effect.gen(function* () {
      const info = yield* fs.stat(target).pipe(Effect.orElseSucceed(() => undefined))
      if (info === undefined || info.type !== 'Directory') {
        return yield* new FolderNotFound({ path: target })
      }

      const names = yield* fs
        .readDirectory(target)
        .pipe(Effect.mapError(() => new FolderReadFailed({ path: target })))

      return yield* Effect.forEach(names, (name) => classify(target, name))
    })

  return FolderReader.of({ listFolder })
})

export const FsFolderReaderLive = Layer.effect(FolderReader, make)
