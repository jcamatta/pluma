// FileWriter adapter backed by the platform FileSystem. The only place that touches real disk I/O.
// Maps filesystem state to the domain's typed errors: existing target -> FileAlreadyExists, missing
// parent directory -> DirectoryNotFound, any other write failure -> FileWriteFailed; for deletion,
// a target that is not an existing regular file -> FileNotFound, any other removal failure ->
// FileDeleteFailed; for writing content, a target that is not an existing regular file -> FileNotFound,
// any other write failure -> FileWriteFailed. Deletion and writing only ever touch regular files.

import { FileSystem } from '@effect/platform/FileSystem'
import { Path } from '@effect/platform/Path'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import { FileAlreadyExists } from '../../application/file/error/file-already-exists'
import { DirectoryNotFound } from '../../application/file/error/directory-not-found'
import { FileWriteFailed } from '../../application/file/error/file-write-failed'
import { FileNotFound } from '../../application/file/error/file-not-found'
import { FileDeleteFailed } from '../../application/file/error/file-delete-failed'
import { FileWriter } from '../../application/file/port/file-writer.port'

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

  const deleteFile = (target: string): Effect.Effect<void, FileNotFound | FileDeleteFailed> =>
    Effect.gen(function* () {
      const info = yield* fs.stat(target).pipe(Effect.orElseSucceed(() => undefined))
      if (info === undefined || info.type !== 'File') {
        return yield* new FileNotFound({ path: target })
      }

      return yield* fs
        .remove(target)
        .pipe(Effect.mapError(() => new FileDeleteFailed({ path: target })))
    })

  const writeFile = (
    target: string,
    content: string
  ): Effect.Effect<void, FileNotFound | FileWriteFailed> =>
    Effect.gen(function* () {
      const info = yield* fs.stat(target).pipe(Effect.orElseSucceed(() => undefined))
      if (info === undefined || info.type !== 'File') {
        return yield* new FileNotFound({ path: target })
      }

      return yield* fs
        .writeFileString(target, content)
        .pipe(Effect.mapError(() => new FileWriteFailed({ path: target })))
    })

  return FileWriter.of({ createEmptyFile, deleteFile, writeFile })
})

export const FsFileWriterLive = Layer.effect(FileWriter, make)
