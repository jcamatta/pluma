// The stable identity of an artifact across files. Ids (a_1, p_1) are minted per editor, so they
// collide between files; pairing the owning file path with the id makes a key unique across every
// open file. Used for React list keys, the active-membership set, and resolving which editor a card's
// command targets. Pure calculation.

import type { Artifact } from './artifact'

function artifactKey(artifact: Pick<Artifact, 'path' | 'id'>): string {
  return `${artifact.path}::${artifact.id}`
}

export { artifactKey }
