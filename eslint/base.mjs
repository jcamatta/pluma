// Base ESLint setup: global ignores, TypeScript recommended rules, and React settings.

import tseslint from '@electron-toolkit/eslint-config-ts'
import eslintPluginReact from 'eslint-plugin-react'

export const ignores = {
  ignores: ['**/node_modules', '**/dist', '**/out', '.references/**', '**/*.html']
}

export const base = [
  tseslint.configs.recommended,
  eslintPluginReact.configs.flat.recommended,
  eslintPluginReact.configs.flat['jsx-runtime'],
  {
    settings: {
      react: {
        version: 'detect'
      }
    }
  }
]
