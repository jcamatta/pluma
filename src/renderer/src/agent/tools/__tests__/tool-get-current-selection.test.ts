// get_current_selection: serializes the selected slice to Markdown and registers a tracked range
// covering the selection.

import { describe, expect, it } from 'vitest'
import { getRange } from '../../../editor/extensions/ranges'
import { withEditor } from '../../../editor/extensions/__tests__/editor-test-harness'
import { getCurrentSelection } from '../tool-get-current-selection'
import { stringField } from './result-helpers'

describe('getCurrentSelection', () => {
  it('registers a range for the current selection', () => {
    withEditor('hello world', (editor) => {
      const start = editor.state.doc.textContent.indexOf('world') + 1
      editor.commands.setTextSelection({ from: start, to: start + 'world'.length })

      const rangeId = stringField(getCurrentSelection(editor), 'rangeId')

      expect(getRange({ editor, id: rangeId })?.originalText).toBe('world')
    })
  })
})
