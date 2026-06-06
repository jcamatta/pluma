// Bans ESLint disable directives outright. The agent must not silence rules line by line; if a rule
// is wrong, change the rule in config, do not suppress it inline.

import eslintComments from '@eslint-community/eslint-plugin-eslint-comments'

export const comments = {
  files: ['**/*.{ts,tsx,mjs,js}'],
  plugins: {
    '@eslint-community/eslint-comments': eslintComments
  },
  rules: {
    '@eslint-community/eslint-comments/no-use': 'error'
  }
}
