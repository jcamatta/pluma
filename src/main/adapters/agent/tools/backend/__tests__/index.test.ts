import { describe, expect, it } from 'vitest'
import type { ToolBridge } from '../../tool-bridge'
import { backendTools } from '../index'

const stubBridge: ToolBridge = {
  callTool: () => Promise.resolve({ ok: false, error: 'declined' }),
  resolve: () => undefined,
  rejectAll: () => undefined
}

describe('backendTools', () => {
  it('yields the read tools plus the gated command tools with their spec names', () => {
    const tools = backendTools({ cwd: '/workspace', bridge: stubBridge, runId: 'run-1' })

    expect(tools.map((t) => t.spec.name)).toStrictEqual([
      'read_file',
      'list_folder',
      'create_file',
      'rename_file',
      'delete_file'
    ])
  })
})
