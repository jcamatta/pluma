// Pure layout of a stored asset: the content-hashed file name, the assets directory it lives in, and the
// workspace-root-relative path the markdown references. The relative path always uses forward slashes so
// the stored markdown is portable across platforms.

const ASSETS_DIR = 'assets'

const assetStoragePath = (input: {
  readonly hash: string
  readonly extension: string
}): { readonly dir: string; readonly fileName: string; readonly relativePath: string } => {
  const fileName = `${input.hash}.${input.extension}`
  return { dir: ASSETS_DIR, fileName, relativePath: `${ASSETS_DIR}/${fileName}` }
}

export { assetStoragePath }
