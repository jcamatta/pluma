// Tests for the JSON-Schema -> Zod-raw-shape converter. We assert the produced shape parses what the
// spec allows and rejects what it forbids, covering our spec surface: empty params, required strings,
// optional strings, and enum constraints.

import { z } from 'zod'
import { describe, expect, it } from 'vitest'
import { jsonSchemaToZodShape } from '../json-schema-to-zod'

describe('jsonSchemaToZodShape', () => {
  it('produces an empty shape for an object with no properties', () => {
    const shape = jsonSchemaToZodShape({ type: 'object', properties: {} })

    expect(Object.keys(shape)).toHaveLength(0)
    expect(z.object(shape).parse({})).toEqual({})
  })

  it('produces an empty shape for a non-object schema', () => {
    expect(Object.keys(jsonSchemaToZodShape(undefined))).toHaveLength(0)
    expect(Object.keys(jsonSchemaToZodShape(null))).toHaveLength(0)
  })

  it('makes required string properties required', () => {
    const shape = jsonSchemaToZodShape({
      type: 'object',
      required: ['text'],
      properties: { text: { type: 'string' } }
    })
    const schema = z.object(shape)

    expect(schema.parse({ text: 'hi' })).toEqual({ text: 'hi' })
    expect(() => schema.parse({})).toThrow()
  })

  it('makes non-required properties optional', () => {
    const shape = jsonSchemaToZodShape({
      type: 'object',
      required: ['rangeId'],
      properties: { rangeId: { type: 'string' }, severity: { type: 'string' } }
    })
    const schema = z.object(shape)

    expect(schema.parse({ rangeId: 'r1' })).toEqual({ rangeId: 'r1' })
  })

  it('constrains enum properties to their allowed values', () => {
    const shape = jsonSchemaToZodShape({
      type: 'object',
      properties: { severity: { type: 'string', enum: ['info', 'warning', 'error'] } }
    })
    const schema = z.object(shape)

    expect(schema.parse({ severity: 'error' })).toEqual({ severity: 'error' })
    expect(() => schema.parse({ severity: 'nope' })).toThrow()
  })
})
