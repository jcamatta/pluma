// FileWriter adapter backed by the platform FileSystem. The only place that touches real disk I/O.
// Maps filesystem state to the domain's typed errors: existing target -> FileAlreadyExists, missing
// parent directory -> DirectoryNotFound, any other write failure -> FileWriteFailed.

import { FileSystem } from '@effect/platform/FileSystem'
import { Path } from '@effect/platform/Path'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import { FileAlreadyExists } from '../../application/file/error/file-already-exists'
import { DirectoryNotFound } from '../../application/file/error/directory-not-found'
import { FileWriteFailed } from '../../application/file/error/file-write-failed'
import { FileWriter } from '../../application/file/file-writer.port'

const make = Effect.gen(function* () {
  const fs = yield* FileSystem
  const path = yield* Path

  const createEmptyFile = (
    target: string
  ): Effect.Effect<void, FileAlreadyExists | DirectoryNotFound | FileWriteFailed> =>
    Effect.gen(function* () {
      const fileExists = yield* fs.exists(target).pipe(Effect.orElseSucceed(() => false))
      if (fileExists) {
        return yield* new FileAlreadyExists({ path: target })
      }

      const parent = path.dirname(target)
      const parentExists = yield* fs.exists(parent).pipe(Effect.orElseSucceed(() => false))
      if (!parentExists) {
        return yield* new DirectoryNotFound({ path: target })
      }

      return yield* fs
        .writeFileString(target, '')
        .pipe(Effect.mapError(() => new FileWriteFailed({ path: target })))
    })

  return FileWriter.of({ createEmptyFile })
})

export const FsFileWriterLive = Layer.effect(FileWriter, make)
