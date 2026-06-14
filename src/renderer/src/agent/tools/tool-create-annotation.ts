// Handler for `create_annotation`: anchor a review note to a passage given by its exact text. Resolves
// the text to a single span with the shared resolver; a missing or repeated passage fails recoverably
// (not_found / ambiguous), so the agent grows the text until unique and retries. Severity defaults to
// 'warning' when the model omits it.

import type { Editor } from '@tiptap/core'
import { createAnnotation, type AnnotationSeverity } from '../../editor/extensions/annotations'
import { resolveAnchor } from './resolve-anchor'
import type { AgentToolResult } from './types'

interface CreateAnnotationArgs {
  readonly text: string
  readonly label: string
  readonly description: string
  readonly severity?: AnnotationSeverity
}

export function createAnnotationTool(editor: Editor, args: CreateAnnotationArgs): AgentToolResult {
  const resolved = resolveAnchor(editor, args.text)
  if (!resolved.ok) return { ok: false, error: resolved.error }

  const annotation = createAnnotation({
    editor,
    annotation: {
      from: resolved.from,
      to: resolved.to,
      label: args.label,
      description: args.description,
      severity: args.severity ?? 'warning',
      quote: args.text
    }
  })

  return { ok: true, output: { type: 'json', value: { annotationId: annotation.id } } }
}
