// get_current_document: returns the document serialized to Markdown as a text output.

import { describe, expect, it } from 'vitest'
import { withEditor } from '../../../editor/extensions/__tests__/editor-test-harness'
import { getCurrentDocument } from '../tool-get-current-document'

describe('getCurrentDocument', () => {
  it('returns the document as markdown text', () => {
    withEditor('# Title\n\nA paragraph.', (editor) => {
      const result = getCurrentDocument(editor)

      if (!result.ok || result.output.type !== 'text') return expect.fail('expected text output')
      expect(result.output.text).toContain('# Title')
      expect(result.output.text).toContain('A paragraph.')
    })
  })
})
