// EditorController mounts the manuscript editor and renders the view once the editor is ready.

import { describe, expect, it } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { EditorController } from '../Editor.controller'

describe('EditorController', () => {
  it('renders the editor surface once the editor instance is ready', async () => {
    const { container } = render(<EditorController />)

    await waitFor(() => {
      expect(container.querySelector('.ProseMirror')).not.toBeNull()
    })
  })
})
