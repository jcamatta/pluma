// Paste/drop handling for images. On either event we resolve the source (a remote/url image wins over a
// degraded pasted file — see image-source-logic), encode a chosen file to a data URL, and insert an image
// node. onDrop inserts at the drop position; onPaste inserts at the current selection (pos null).

import FileHandler from '@tiptap/extension-file-handler'
import type { Editor } from '@tiptap/core'
import { ALLOWED_IMAGE_MIME_TYPES, resolveImageSource } from './image-source-logic'
import type { ImageSource } from './image-source-logic'
import { fileToDataUrl } from './file-to-data-url'

function insertImageAt(editor: Editor, image: { src: string; pos: number | null }): boolean {
  const content = { type: 'image', attrs: { src: image.src } }
  return image.pos === null
    ? editor.commands.insertContent(content)
    : editor.commands.insertContentAt(image.pos, content)
}

async function insertImageSource(
  editor: Editor,
  resolved: { source: ImageSource; pos: number | null }
): Promise<void> {
  const { source, pos } = resolved
  const src = source.kind === 'url' ? source.src : await fileToDataUrl(source.file)
  if (src !== null) insertImageAt(editor, { src, pos })
}

function handleImageFiles(
  editor: Editor,
  input: { files: File[]; pos: number | null; htmlContent?: string }
): void {
  const source = resolveImageSource({ files: input.files, htmlContent: input.htmlContent })
  if (source !== null) void insertImageSource(editor, { source, pos: input.pos })
}

type DropArgs = [editor: Editor, files: File[], pos: number]
type PasteArgs = [editor: Editor, files: File[], htmlContent?: string]

function handleDrop(...args: DropArgs): void {
  const [editor, files, pos] = args
  handleImageFiles(editor, { files, pos })
}

function handlePaste(...args: PasteArgs): void {
  const [editor, files, htmlContent] = args
  handleImageFiles(editor, { files, pos: null, htmlContent })
}

const FileHandlerExtension = FileHandler.configure({
  allowedMimeTypes: ALLOWED_IMAGE_MIME_TYPES,
  onDrop: handleDrop,
  onPaste: handlePaste
})

export { FileHandlerExtension, insertImageAt, insertImageSource }
