// toolOutcomeStatus reads the serialized tool result the rail's TOOL_CALL_RESULT event carries and
// decides whether the step rendered as a success or a failure. ok:false → failed; everything else,
// including unparseable or shape-less content, → success (a missing flag is not evidence of failure).

import { describe, expect, it } from 'vitest'
import { toolOutcomeStatus } from '../tool-outcome'

describe('toolOutcomeStatus', () => {
  it('reports failed for an ok:false result', () => {
    expect(toolOutcomeStatus('{"ok":false,"error":"Maximum call stack size exceeded"}')).toBe(
      'failed'
    )
  })

  it('reports success for an ok:true result', () => {
    expect(toolOutcomeStatus('{"ok":true,"output":{"type":"json","value":{}}}')).toBe('success')
  })

  it('reports success for content that is not valid JSON', () => {
    expect(toolOutcomeStatus('proposed')).toBe('success')
  })

  it('reports success for a result with no ok flag', () => {
    expect(toolOutcomeStatus('{"value":42}')).toBe('success')
  })

  it('reports success for empty content', () => {
    expect(toolOutcomeStatus('')).toBe('success')
  })
})
