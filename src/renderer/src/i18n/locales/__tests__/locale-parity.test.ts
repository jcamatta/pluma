// Guards that every locale stays in lockstep with the English source: identical key sets (no missing or
// extra keys) and matching interpolation placeholders per key ({{name}}, {{count}}, …). A missing key
// would silently fall back to English; a dropped/renamed placeholder would render a broken string.

import { describe, expect, it } from 'vitest'
import en from '../en.json'
import es from '../es.json'

type Json = string | { readonly [key: string]: Json }

function flatten(value: Json, prefix: string): ReadonlyMap<string, string> {
  if (typeof value === 'string') return new Map([[prefix, value]])
  return Object.entries(value).reduce((acc, [key, child]) => {
    const path = prefix === '' ? key : `${prefix}.${key}`
    return new Map([...acc, ...flatten(child, path)])
  }, new Map<string, string>())
}

function placeholders(text: string): readonly string[] {
  return (text.match(/{{\s*[\w]+\s*}}/g) ?? []).map((token) => token.replace(/\s/g, '')).sort()
}

const enFlat = flatten(en, '')
const esFlat = flatten(es, '')

describe('locale parity (es vs en)', () => {
  it('has the exact same set of keys as en', () => {
    expect([...esFlat.keys()].sort()).toEqual([...enFlat.keys()].sort())
  })

  it('preserves the same interpolation placeholders per key', () => {
    const mismatched = [...enFlat.entries()].filter(([key, value]) => {
      const translated = esFlat.get(key)
      return translated === undefined
        ? false
        : JSON.stringify(placeholders(value)) !== JSON.stringify(placeholders(translated))
    })
    expect(mismatched.map(([key]) => key)).toEqual([])
  })
})
