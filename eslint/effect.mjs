// Effect-specific lint rules. Currently the barrel-import guard, which keeps imports pointing at
// concrete modules instead of large re-export barrels (better tree-shaking and clearer dependencies).

import effectPlugin from '@effect/eslint-plugin'

export const effect = {
  files: ['src/**/*.{ts,tsx}'],
  plugins: {
    '@effect': effectPlugin
  },
  rules: {
    '@effect/no-import-from-barrel-package': [
      'error',
      { packageNames: ['effect', '@effect/platform', '@effect/platform-node'] }
    ]
  }
}
