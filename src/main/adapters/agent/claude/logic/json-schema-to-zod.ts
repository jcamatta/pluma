// Calculation: convert an AG-UI tool spec's JSON-Schema `parameters` into the Zod raw shape the Claude
// SDK's `tool()` requires. Our specs are hand-authored and intentionally narrow — a flat object whose
// properties are strings (optionally constrained to an enum), with a `required` list — so this handles
// exactly that surface rather than the whole of JSON Schema. The produced shape only has to describe the
// tool's input to the model and satisfy the SDK; the handler forwards the raw args to the renderer and
// never consumes the parsed value, so unknown property shapes degrade to a permissive z.unknown().

import { z, type ZodRawShape, type ZodType } from 'zod'

interface JsonSchemaProperty {
  readonly type?: string
  readonly enum?: readonly string[]
  readonly description?: string
}

interface ObjectJsonSchema {
  readonly type?: string
  readonly properties?: Record<string, JsonSchemaProperty>
  readonly required?: readonly string[]
}

const baseType = (property: JsonSchemaProperty): ZodType => {
  if (property.enum !== undefined && property.enum.length > 0) {
    return z.enum([...property.enum])
  }
  if (property.type === 'string') {
    return z.string()
  }
  if (property.type === 'number' || property.type === 'integer') {
    return z.number()
  }
  if (property.type === 'boolean') {
    return z.boolean()
  }
  return z.unknown()
}

const describe = (schema: ZodType, description: string | undefined): ZodType =>
  description === undefined ? schema : schema.describe(description)

const toField = (property: JsonSchemaProperty, isRequired: boolean): ZodType => {
  const typed = describe(baseType(property), property.description)
  return isRequired ? typed : typed.optional()
}

// Build the Zod raw shape for one tool's parameters. A non-object schema (or one with no properties)
// yields an empty shape — a tool that takes no arguments.
export const jsonSchemaToZodShape = (parameters: unknown): ZodRawShape => {
  const schema: ObjectJsonSchema =
    typeof parameters === 'object' && parameters !== null ? parameters : {}
  const properties = schema.properties ?? {}
  const required = new Set(schema.required ?? [])

  return Object.fromEntries(
    Object.entries(properties).map(([name, property]) => [
      name,
      toField(property, required.has(name))
    ])
  )
}
