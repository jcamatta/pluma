// The reactive bridge: open/move/select/close transitions, index wrapping, command dispatch, and subscriber
// notifications — all driven directly, no editor or DOM.

import { describe, expect, it, vi } from 'vitest'
import { createSlashBridge } from '../slash-menu-bridge'
import type { SlashOpenInput } from '../slash-menu-bridge'
import type { SlashCommandItem } from '../slash-command-catalog'

const items: readonly SlashCommandItem[] = [
  { id: 'text', labelKey: 'a', hint: '', keywords: [] },
  { id: 'heading1', labelKey: 'b', hint: '#', keywords: [] },
  { id: 'heading2', labelKey: 'c', hint: '##', keywords: [] }
]

const openInput = (command: SlashOpenInput['command']): SlashOpenInput => ({
  items,
  command,
  caret: { top: 0, bottom: 20, left: 10 }
})

describe('createSlashBridge', () => {
  it('starts closed', () => {
    const bridge = createSlashBridge()
    expect(bridge.getSnapshot().active).toBe(false)
  })

  it('opens at index 0 with the supplied items and caret', () => {
    const bridge = createSlashBridge()
    bridge.open(openInput(vi.fn()))
    const snapshot = bridge.getSnapshot()
    expect(snapshot.active).toBe(true)
    expect(snapshot.index).toBe(0)
    expect(snapshot.items).toHaveLength(3)
    expect(snapshot.caret).toEqual({ top: 0, bottom: 20, left: 10 })
  })

  it('notifies subscribers on change and stops after unsubscribe', () => {
    const bridge = createSlashBridge()
    const listener = vi.fn()
    const unsubscribe = bridge.subscribe(listener)
    bridge.open(openInput(vi.fn()))
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
    bridge.close()
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('wraps the index forward past the end', () => {
    const bridge = createSlashBridge()
    bridge.open(openInput(vi.fn()))
    bridge.move(1)
    bridge.move(1)
    expect(bridge.getSnapshot().index).toBe(2)
    bridge.move(1)
    expect(bridge.getSnapshot().index).toBe(0)
  })

  it('wraps the index backward before the start', () => {
    const bridge = createSlashBridge()
    bridge.open(openInput(vi.fn()))
    bridge.move(-1)
    expect(bridge.getSnapshot().index).toBe(2)
  })

  it('ignores move and select while closed', () => {
    const bridge = createSlashBridge()
    const command = vi.fn()
    bridge.move(1)
    bridge.select()
    expect(bridge.getSnapshot().active).toBe(false)
    expect(command).not.toHaveBeenCalled()
  })

  it('selects the highlighted item, runs its command, and closes', () => {
    const bridge = createSlashBridge()
    const command = vi.fn()
    bridge.open(openInput(command))
    bridge.move(1)
    bridge.select()
    expect(command).toHaveBeenCalledWith(items[1])
    expect(bridge.getSnapshot().active).toBe(false)
  })

  it('selects an explicit index when given', () => {
    const bridge = createSlashBridge()
    const command = vi.fn()
    bridge.open(openInput(command))
    bridge.select(2)
    expect(command).toHaveBeenCalledWith(items[2])
  })

  it('does nothing on select when there are no items', () => {
    const bridge = createSlashBridge()
    const command = vi.fn()
    bridge.open({ items: [], command, caret: null })
    bridge.select()
    expect(command).not.toHaveBeenCalled()
    expect(bridge.getSnapshot().active).toBe(true)
  })
})
