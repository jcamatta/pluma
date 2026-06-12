// FolderWriter adapter backed by the platform FileSystem. The only place that touches real disk I/O.
// Maps filesystem state to the domain's typed errors: existing target -> FolderAlreadyExists,
// missing parent directory -> ParentDirectoryNotFound, any other creation failure ->
// FolderCreationFailed; for deletion, a target that is not an existing directory -> FolderNotFound,
// any other removal failure -> FolderDeleteFailed; for renaming, a source that is not an existing
// directory -> FolderNotFound, an already-occupied destination -> FolderAlreadyExists, any other move
// failure -> FolderRenameFailed. Creation makes only the final folder, never missing parents. Deletion
// removes the folder and all of its contents recursively, and only ever removes directories, never
// regular files. Renaming moves the folder and its contents to the destination path.

import { FileSystem } from '@effect/platform/FileSystem'
import { Path } from '@effect/platform/Path'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import { FolderAlreadyExists } from '../../application/folder/error/folder-already-exists'
import { ParentDirectoryNotFound } from '../../application/folder/error/parent-directory-not-found'
import { FolderCreationFailed } from '../../application/folder/error/folder-creation-failed'
import { FolderNotFound } from '../../application/folder/error/folder-not-found'
import { FolderDeleteFailed } from '../../application/folder/error/folder-delete-failed'
import { FolderRenameFailed } from '../../application/folder/error/folder-rename-failed'
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

  const deleteFolder = (target: string): Effect.Effect<void, FolderNotFound | FolderDeleteFailed> =>
    Effect.gen(function* () {
      const info = yield* fs.stat(target).pipe(Effect.orElseSucceed(() => undefined))
      if (info === undefined || info.type !== 'Directory') {
        return yield* new FolderNotFound({ path: target })
      }

      return yield* fs
        .remove(target, { recursive: true })
        .pipe(Effect.mapError(() => new FolderDeleteFailed({ path: target })))
    })

  const renameFolder = (
    source: string,
    destination: string
  ): Effect.Effect<void, FolderNotFound | FolderAlreadyExists | FolderRenameFailed> =>
    Effect.gen(function* () {
      const info = yield* fs.stat(source).pipe(Effect.orElseSucceed(() => undefined))
      if (info === undefined || info.type !== 'Directory') {
        return yield* new FolderNotFound({ path: source })
      }

      const destinationExists = yield* fs
        .exists(destination)
        .pipe(Effect.orElseSucceed(() => false))
      if (destinationExists) {
        return yield* new FolderAlreadyExists({ path: destination })
      }

      return yield* fs
        .rename(source, destination)
        .pipe(Effect.mapError(() => new FolderRenameFailed({ path: destination })))
    })

  return FolderWriter.of({ createFolder, deleteFolder, renameFolder })
})

export const FsFolderWriterLive = Layer.effect(FolderWriter, make)
