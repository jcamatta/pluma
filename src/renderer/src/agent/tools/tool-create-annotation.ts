// Handler for `create_annotation`: anchor a review note to a tracked range. Fails (recoverably) when
// the range is gone or its text drifted, so the agent re-resolves it via get_ranges. Severity
// defaults to 'warning' when the model omits it.

import type { Editor } from '@tiptap/core'
import { getRange } from '../../editor/extensions/ranges'
import { createAnnotation, type AnnotationSeverity } from '../../editor/extensions/annotations'
import type { AgentToolResult } from './types'

interface CreateAnnotationArgs {
  readonly rangeId: string
  readonly label: string
  readonly description: string
  readonly severity?: AnnotationSeverity
}

export function createAnnotationTool(editor: Editor, args: CreateAnnotationArgs): AgentToolResult {
  const range = getRange({ editor, id: args.rangeId })

  if (!range) {
    return { ok: false, error: `Range ${args.rangeId} not found. Call get_ranges again.` }
  }

  if (range.status === 'error') {
    return { ok: false, error: `${range.error} Current text: ${range.currentText}` }
  }

  const annotation = createAnnotation({
    editor,
    annotation: {
      from: range.from,
      to: range.to,
      label: args.label,
      description: args.description,
      severity: args.severity ?? 'warning',
      quote: range.currentText
    }
  })

  return { ok: true, output: { type: 'json', value: { annotationId: annotation.id } } }
}
