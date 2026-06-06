// FolderWriter adapter backed by the platform FileSystem. The only place that touches real disk I/O.
// Maps filesystem state to the domain's typed errors: existing target -> FolderAlreadyExists,
// missing parent directory -> ParentDirectoryNotFound, any other failure -> FolderCreationFailed.
// Creates only the final folder, never missing parents.

import { FileSystem } from '@effect/platform/FileSystem'
import { Path } from '@effect/platform/Path'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import { FolderAlreadyExists } from '../../application/folder/error/folder-already-exists'
import { ParentDirectoryNotFound } from '../../application/folder/error/parent-directory-not-found'
import { FolderCreationFailed } from '../../application/folder/error/folder-creation-failed'
import { FolderWriter } from '../../application/folder/port/folder-writer.port'

const make = Effect.gen(function* () {
  const fs = yield* FileSystem
  const path = yield* Path

  const createFolder = (
    target: string
  ): Effect.Effect<void, FolderAlreadyExists | ParentDirectoryNotFound | FolderCreationFailed> =>
    Effect.gen(function* () {
      const targetExists = yield* fs.exists(target).pipe(Effect.orElseSucceed(() => false))
      if (targetExists) {
        return yield* new FolderAlreadyExists({ path: target })
      }

      const parent = path.dirname(target)
      const parentExists = yield* fs.exists(parent).pipe(Effect.orElseSucceed(() => false))
      if (!parentExists) {
        return yield* new ParentDirectoryNotFound({ path: target })
      }

      return yield* fs
        .makeDirectory(target)
        .pipe(Effect.mapError(() => new FolderCreationFailed({ path: target })))
    })

  return FolderWriter.of({ createFolder })
})

export const FsFolderWriterLive = Layer.effect(FolderWriter, make)
