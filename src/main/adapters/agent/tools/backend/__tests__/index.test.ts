import { describe, expect, it } from 'vitest'
import { backendTools } from '../index'

describe('backendTools', () => {
  it('yields the read and list tools with their spec names', () => {
    const tools = backendTools('/workspace')

    expect(tools.map((t) => t.spec.name)).toStrictEqual(['read_file', 'list_folder'])
  })
})
