// Test harness: builds a headless TipTap editor with the real extension set, mounted on a detached
// DOM node so plugin state and dispatch behave exactly as in the app. withEditor scopes the editor's
// lifetime to a single test so no shared mutable binding is needed.

import { Editor } from '@tiptap/core'
import { editorExtensions } from '../index'

function createTestEditor(content = ''): Editor {
  const element = document.createElement('div')
  document.body.appendChild(element)

  return new Editor({
    element,
    content,
    contentType: 'markdown',
    extensions: editorExtensions
  })
}

function withEditor<T>(content: string, run: (editor: Editor) => T): T {
  const editor = createTestEditor(content)
  try {
    return run(editor)
  } finally {
    editor.destroy()
  }
}

export { createTestEditor, withEditor }
