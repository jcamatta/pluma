// Test that registerIpc wires the file channels onto ipcMain.

import { describe, expect, it, vi } from 'vitest'

const handle = vi.fn()
vi.mock('electron', () => ({ ipcMain: { handle } }))

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
})
