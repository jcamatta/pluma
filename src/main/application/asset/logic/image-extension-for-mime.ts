// Business rule mapping a supported image MIME type to the file extension used when storing it in the
// workspace assets folder. Returns null for any type we do not store, so the use case rejects it rather
// than writing a file with an unknown extension. Mirrors the image types the editor accepts on paste/drop.

const imageExtensionByMime: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp'
}

const imageExtensionForMime = (mimeType: string): string | null =>
  imageExtensionByMime[mimeType] ?? null

export { imageExtensionForMime }
