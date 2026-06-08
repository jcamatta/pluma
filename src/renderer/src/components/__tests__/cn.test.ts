// cn joins class inputs and resolves conflicting Tailwind utilities (last one wins).

import { describe, expect, it } from 'vitest'
import { cn } from '../cn'

describe('cn', () => {
  it('joins truthy class strings', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('drops falsy inputs', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b')
  })

  it('lets a later Tailwind utility override an earlier conflicting one', () => {
    expect(cn('rounded-md', 'rounded-lg')).toBe('rounded-lg')
  })
})
