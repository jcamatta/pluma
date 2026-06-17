// useChatShortcut binds the global Ctrl/Cmd+K writing-focus toggle: from the editor it opens the rail and
// focuses the composer on the next frame; pressed again while the composer holds focus it returns focus to
// the editor instead. Every action is a registered handle (no DOM querying), so the hook is driven here
// through plain mocks.

import { describe, expect, it, vi, type Mock } from 'vitest'
import { renderHook } from '@testing-library/react'
import { isChatShortcut, useChatShortcut } from '../useChatShortcut'

interface Harness {
  readonly openRail: Mock<() => void>
  readonly composerHasFocus: Mock<() => boolean>
  readonly focusComposer: Mock<() => void>
  readonly focusEditor: Mock<() => void>
  readonly unmount: () => void
}

const nextFrame = (): Promise<void> =>
  new Promise((resolve) => requestAnimationFrame(() => resolve()))

const pressCtrlK = (): void => {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
}

function setup(composerFocused: boolean): Harness {
  const openRail = vi.fn<() => void>()
  const composerHasFocus = vi.fn<() => boolean>(() => composerFocused)
  const focusComposer = vi.fn<() => void>()
  const focusEditor = vi.fn<() => void>()
  const { unmount } = renderHook(() =>
    useChatShortcut({ openRail, composerHasFocus, focusComposer, focusEditor })
  )
  return { openRail, composerHasFocus, focusComposer, focusEditor, unmount }
}

describe('isChatShortcut', () => {
  it('matches ctrl+k and cmd+K, and ignores other keys', () => {
    expect(isChatShortcut(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))).toBe(true)
    expect(isChatShortcut(new KeyboardEvent('keydown', { key: 'K', metaKey: true }))).toBe(true)
    expect(isChatShortcut(new KeyboardEvent('keydown', { key: 'k' }))).toBe(false)
    expect(isChatShortcut(new KeyboardEvent('keydown', { key: 'j', ctrlKey: true }))).toBe(false)
  })
})

describe('useChatShortcut', () => {
  it('opens the rail and focuses the composer when the composer is not focused', async () => {
    const { openRail, focusComposer, focusEditor } = setup(false)

    pressCtrlK()
    expect(openRail).toHaveBeenCalledOnce()
    expect(focusEditor).not.toHaveBeenCalled()

    await nextFrame()
    expect(focusComposer).toHaveBeenCalledOnce()
  })

  it('hands focus back to the editor when the composer already holds focus', () => {
    const { openRail, focusComposer, focusEditor } = setup(true)

    pressCtrlK()
    expect(focusEditor).toHaveBeenCalledOnce()
    expect(openRail).not.toHaveBeenCalled()
    expect(focusComposer).not.toHaveBeenCalled()
  })

  it('does nothing for other key combinations', () => {
    const { openRail, focusEditor } = setup(false)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', ctrlKey: true }))
    expect(openRail).not.toHaveBeenCalled()
    expect(focusEditor).not.toHaveBeenCalled()
  })

  it('unbinds the listener on unmount', () => {
    const { openRail, unmount } = setup(false)

    unmount()
    pressCtrlK()
    expect(openRail).not.toHaveBeenCalled()
  })
})
