// Test that registerIpc wires the file channels onto ipcMain.

import * as Effect from 'effect/Effect'
import * as Scope from 'effect/Scope'
import { describe, expect, it, vi } from 'vitest'

const handle = vi.fn()
const removeHandler = vi.fn()
vi.mock('electron', () => ({ ipcMain: { handle, removeHandler } }))

describe('registerIpc', () => {
  it('registers the file:create channel', async () => {
    const { registerIpc } = await import('../register')
    registerIpc()

    expect(handle).toHaveBeenCalledWith('file:create', expect.any(Function))
  })

  it('registers the file:delete channel', async () => {
    const { registerIpc } = await import('../register')
    registerIpc()

    expect(handle).toHaveBeenCalledWith('file:delete', expect.any(Function))
  })

  it('registers the file:write channel', async () => {
    const { registerIpc } = await import('../register')
    registerIpc()

    expect(handle).toHaveBeenCalledWith('file:write', expect.any(Function))
  })

  it('registers the file:read channel', async () => {
    const { registerIpc } = await import('../register')
    registerIpc()

    expect(handle).toHaveBeenCalledWith('file:read', expect.any(Function))
  })

  it('registers the folder:create channel', async () => {
    const { registerIpc } = await import('../register')
    registerIpc()

    expect(handle).toHaveBeenCalledWith('folder:create', expect.any(Function))
  })

  it('registers the folder:delete channel', async () => {
    const { registerIpc } = await import('../register')
    registerIpc()

    expect(handle).toHaveBeenCalledWith('folder:delete', expect.any(Function))
  })

  it('registers the folder:list channel', async () => {
    const { registerIpc } = await import('../register')
    registerIpc()

    expect(handle).toHaveBeenCalledWith('folder:list', expect.any(Function))
  })

  it('registers the folder:pick channel', async () => {
    const { registerIpc } = await import('../register')
    registerIpc()

    expect(handle).toHaveBeenCalledWith('folder:pick', expect.any(Function))
  })

  it('registers the folder:watch channel for the window', async () => {
    const { registerWatch } = await import('../register')
    const scope = Effect.runSync(Scope.make())
    registerWatch({
      window: { isDestroyed: () => false, webContents: { send: vi.fn() } },
      scope
    })

    expect(handle).toHaveBeenCalledWith('folder:watch', expect.any(Function))
  })
})
