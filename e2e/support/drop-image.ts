// Drops a PNG file onto a locator the way the OS does: a real `drop` DragEvent carrying a DataTransfer
// with a File, dispatched at the element's centre so the editor resolves a valid insert position. Used to
// exercise the FileHandler paste/drop path in the real app without mocking window.api or the editor.

import type { Locator } from '@playwright/test'

const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

async function dropImage(surface: Locator, fileName: string): Promise<void> {
  await surface.evaluate(
    (element, { base64, name }) => {
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
      const transfer = new DataTransfer()
      transfer.items.add(new File([bytes], name, { type: 'image/png' }))
      const rect = element.getBoundingClientRect()
      element.dispatchEvent(
        new DragEvent('drop', {
          bubbles: true,
          cancelable: true,
          dataTransfer: transfer,
          clientX: rect.x + rect.width / 2,
          clientY: rect.y + rect.height / 2
        })
      )
    },
    { base64: TINY_PNG_BASE64, name: fileName }
  )
}

export { dropImage }
