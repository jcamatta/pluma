// FileReader adapter backed by the platform FileSystem. The only read place that touches real disk
// I/O for files. Maps filesystem state to the domain's typed errors: a target that is not an existing
// regular file -> FileNotFound, any other read failure -> FileReadFailed. Only ever reads regular
// files.

import { FileSystem } from '@effect/platform/FileSystem'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import { FileNotFound } from '../../application/file/error/file-not-found'
import { FileReadFailed } from '../../application/file/error/file-read-failed'
import { FileReader } from '../../application/file/port/file-reader.port'

const make = Effect.gen(function* () {
  const fs = yield* FileSystem

  const readFile = (target: string): Effect.Effect<string, FileNotFound | FileReadFailed> =>
    Effect.gen(function* () {
      const info = yield* fs.stat(target).pipe(Effect.orElseSucceed(() => undefined))
      if (info === undefined || info.type !== 'File') {
        return yield* new FileNotFound({ path: target })
      }

      return yield* fs
        .readFileString(target)
        .pipe(Effect.mapError(() => new FileReadFailed({ path: target })))
    })

  return FileReader.of({ readFile })
})

export const FsFileReaderLive = Layer.effect(FileReader, make)
