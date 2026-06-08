// Creates a real temporary folder (optionally seeded with files) for a spec to "open", then drives the
// body and removes it afterwards. A withResource-style helper so specs never hold a mutable binding for
// the path. The folder is real on disk: the launched app's real list/create/delete/watch all run
// against it.

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

type Seed = {
  readonly name: string
  readonly content: string
}

const withTempFolder = async <T>(
  seeds: readonly Seed[],
  body: (folder: string) => Promise<T>
): Promise<T> => {
  const folder = await mkdtemp(join(tmpdir(), 'pluma-e2e-'))
  try {
    await Promise.all(seeds.map((seed) => writeFile(join(folder, seed.name), seed.content)))
    return await body(folder)
  } finally {
    await rm(folder, { recursive: true, force: true })
  }
}

export { withTempFolder, type Seed }
