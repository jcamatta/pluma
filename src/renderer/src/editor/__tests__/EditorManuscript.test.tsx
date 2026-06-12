// EditorManuscript renders the editor content and applies the zoom CSS variable. Pure-props render.

import { createRef } from 'react'
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { i18n } from '../../i18n'
import { EditorManuscript } from '../EditorManuscript'
import { withEditor } from '../extensions/__tests__/editor-test-harness'

describe('EditorManuscript', () => {
  it('renders the editor surface with the zoom variable applied', () => {
    withEditor('hello', (editor) => {
      const containerRef = createRef<HTMLDivElement>()

      const { container } = render(
        <I18nextProvider i18n={i18n}>
          <EditorManuscript editor={editor} zoom={1.25} containerRef={containerRef} />
        </I18nextProvider>
      )

      const zoomContainer = container.querySelector('[style*="--editor-zoom"]')
      expect(zoomContainer).not.toBeNull()
      expect(zoomContainer?.getAttribute('style')).toContain('1.25')
      expect(container.querySelector('.ProseMirror')).not.toBeNull()
    })
  })
})
