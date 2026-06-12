// Test that registerIpc wires the stateless request/response channels onto ipcMain, and that
// registerWatch wires the per-window folder:watch channel.

import * as Effect from 'effect/Effect'
import * as Scope from 'effect/Scope'
import { describe, expect, it, vi } from 'vitest'

const handle = vi.fn()
const removeHandler = vi.fn()
vi.mock('electron', () => ({ ipcMain: { handle, removeHandler } }))

const STATELESS_CHANNELS = [
  'file:create',
  'file:delete',
  'file:write',
  'file:read',
  'folder:create',
  'folder:delete',
  'folder:rename',
  'folder:list',
  'folder:pick',
  'agent:list-threads',
  'agent:thread-history',
  'agent:rename-thread',
  'agent:delete-thread'
]

describe('registerIpc', () => {
  it.each(STATELESS_CHANNELS)('registers the %s channel', async (channel) => {
    const { registerIpc } = await import('../register')
    registerIpc()

    expect(handle).toHaveBeenCalledWith(channel, expect.any(Function))
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
