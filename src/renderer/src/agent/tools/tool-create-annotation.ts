// Handler for `create_annotation`: anchor a review note to a passage given by its exact text. Resolves
// the text to a single span with the shared resolver; a missing or repeated passage fails recoverably
// (not_found / ambiguous), so the agent grows the text until unique and retries. Severity defaults to
// 'warning' when the model omits it.

import type { Editor } from '@tiptap/core'
import {
  createAnnotation as addAnnotation,
  type AnnotationSeverity
} from '../../editor/extensions/annotations'
import { resolveAnchor } from './resolve-anchor'
import type { AgentToolResult } from './types'

interface CreateAnnotationInput {
  readonly editor: Editor
  readonly text: string
  readonly label: string
  readonly description: string
  readonly severity?: AnnotationSeverity
}

function createAnnotation({
  editor,
  text,
  label,
  description,
  severity
}: CreateAnnotationInput): AgentToolResult {
  const resolved = resolveAnchor(editor, text)
  if (!resolved.ok) return { ok: false, error: resolved.error }

  const annotation = addAnnotation({
    editor,
    annotation: {
      from: resolved.from,
      to: resolved.to,
      label,
      description,
      severity: severity ?? 'warning',
      quote: text
    }
  })

  return { ok: true, output: { type: 'json', value: { annotationId: annotation.id } } }
}

export { createAnnotation }
export type { CreateAnnotationInput }
