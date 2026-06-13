// get_content: returns an open file's document serialized to Markdown, tagged with the file's path.

import { describe, expect, it } from 'vitest'
import { withEditor } from '../../../editor/extensions/__tests__/editor-test-harness'
import { getContent } from '../tool-get-content'

describe('getContent', () => {
  it('returns the document markdown tagged with its path', () => {
    withEditor('# Title\n\nA paragraph.', (editor) => {
      const result = getContent({ editor, path: '/book/chapter.md' })

      if (!result.ok || result.output.type !== 'json') return expect.fail('expected json output')
      const value: unknown = result.output.value
      if (typeof value !== 'object' || value === null) return expect.fail('expected an object value')
      expect(value).toMatchObject({ path: '/book/chapter.md' })
      if (!('markdown' in value) || typeof value.markdown !== 'string') {
        return expect.fail('expected a markdown string')
      }
      expect(value.markdown).toContain('# Title')
      expect(value.markdown).toContain('A paragraph.')
    })
  })
})
