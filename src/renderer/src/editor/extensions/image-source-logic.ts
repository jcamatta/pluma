// Pure logic deciding what image source to insert from a paste/drop. The FileHandler callback hands us
// the dropped/pasted files plus, on paste, the source HTML. A real GIF copied from another app arrives
// in `files` as a single-frame PNG, while the original animated URL survives in that HTML — so when the
// HTML carries an image, we prefer its URL over the degraded file. Otherwise we encode the first image
// file. No DOM mutation or I/O happens here, only parsing of the given strings/files.

const ALLOWED_IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']

type ImageSource = { kind: 'url'; src: string } | { kind: 'file'; file: File }

function filterImageFiles(files: readonly File[]): File[] {
  return files.filter((file) => ALLOWED_IMAGE_MIME_TYPES.includes(file.type))
}

function extractImageSrc(htmlContent: string): string | null {
  const doc = new DOMParser().parseFromString(htmlContent, 'text/html')
  const src = doc.querySelector('img')?.getAttribute('src') ?? ''
  return src.length > 0 ? src : null
}

function resolveImageSource(input: {
  files: readonly File[]
  htmlContent?: string
}): ImageSource | null {
  const htmlSrc = input.htmlContent ? extractImageSrc(input.htmlContent) : null
  if (htmlSrc !== null) return { kind: 'url', src: htmlSrc }

  const imageFiles = filterImageFiles(input.files)
  return imageFiles.length > 0 ? { kind: 'file', file: imageFiles[0] } : null
}

export { ALLOWED_IMAGE_MIME_TYPES, filterImageFiles, extractImageSrc, resolveImageSource }
export type { ImageSource }
