// EditorView is the editor panel: it composes the top bar (file name + settings) above the manuscript
// surface. Pure-props render.

import { createRef } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EditorView } from '../Editor.view'
import { withEditor } from '../extensions/__tests__/editor-test-harness'

describe('EditorView', () => {
  it('renders the top bar with the file name and the manuscript surface', () => {
    withEditor('hello', (editor) => {
      const containerRef = createRef<HTMLDivElement>()

      const { container } = render(
        <EditorView
          editor={editor}
          zoom={1}
          containerRef={containerRef}
          fileName="Act I"
          settingsLabel="Settings"
          onOpenSettings={() => undefined}
        />
      )

      expect(screen.getByText('Act I')).toBeInTheDocument()
      expect(screen.getByLabelText('Settings')).toBeInTheDocument()
      expect(container.querySelector('.ProseMirror')).not.toBeNull()
    })
  })
})
