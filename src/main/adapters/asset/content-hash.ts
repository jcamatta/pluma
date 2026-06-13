// Deterministic content hash for naming a stored asset. Same bytes always yield the same hex digest, so
// an image stored twice resolves to the same file name (dedup) and re-writing it is idempotent.

import { createHash } from 'node:crypto'

const sha256Hex = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex')

export { sha256Hex }
