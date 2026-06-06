// Tests for the pickFolder use case against an in-memory FolderPicker fake. Covers the success path
// and each typed failure the port can produce.

import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as Layer from 'effect/Layer'
import { describe, expect, it } from 'vitest'
import { FolderSelectionCancelled } from '../../error/folder-selection-cancelled'
import { FolderSelectionFailed } from '../../error/folder-selection-failed'
import { pickFolder } from '../pick-folder'
import { FolderPicker } from '../../port/folder-picker.port'
import type { FolderPickerPort } from '../../port/folder-picker.port'

const pickerThatReturns = (path: string): Layer.Layer<FolderPickerPort> =>
  Layer.succeed(FolderPicker, FolderPicker.of({ pickFolder: () => Effect.succeed(path) }))

const pickerThatFails = (
  error: FolderSelectionCancelled | FolderSelectionFailed
): Layer.Layer<FolderPickerPort> =>
  Layer.succeed(FolderPicker, FolderPicker.of({ pickFolder: () => Effect.fail(error) }))

const run = <A, E>(
  effect: Effect.Effect<A, E, FolderPickerPort>,
  layer: Layer.Layer<FolderPickerPort>
): Exit.Exit<A, E> => Effect.runSyncExit(Effect.provide(effect, layer))

describe('pickFolder', () => {
  it('returns the picked folder path', () => {
    const exit = run(pickFolder(), pickerThatReturns('/notes'))
    expect(exit).toStrictEqual(Exit.succeed('/notes'))
  })

  it('propagates FolderSelectionCancelled when the user dismisses the dialog', () => {
    const error = new FolderSelectionCancelled({})
    const exit = run(pickFolder(), pickerThatFails(error))
    expect(exit).toStrictEqual(Exit.fail(error))
  })

  it('propagates FolderSelectionFailed when the dialog fails', () => {
    const error = new FolderSelectionFailed({})
    const exit = run(pickFolder(), pickerThatFails(error))
    expect(exit).toStrictEqual(Exit.fail(error))
  })
})
