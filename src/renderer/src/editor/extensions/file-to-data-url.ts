// Reads a file's bytes into a base64 data URL. Resolves to null if the read fails, so a failed paste/drop
// is a no-op rather than an unhandled rejection at the editor edge.

function fileToDataUrl(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(file)
  })
}

export { fileToDataUrl }
