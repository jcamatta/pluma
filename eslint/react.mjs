// React-specific rules: hooks rules of usage and the Vite fast-refresh boundary checks.

import eslintPluginReactHooks from 'eslint-plugin-react-hooks'
import eslintPluginReactRefresh from 'eslint-plugin-react-refresh'

export const react = {
  files: ['**/*.{ts,tsx}'],
  plugins: {
    'react-hooks': eslintPluginReactHooks,
    'react-refresh': eslintPluginReactRefresh
  },
  rules: {
    ...eslintPluginReactHooks.configs.recommended.rules,
    ...eslintPluginReactRefresh.configs.vite.rules
  }
}
