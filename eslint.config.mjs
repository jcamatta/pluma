// Root ESLint config. Each concern lives in its own module under ./eslint and is composed here.
// Order matters: scoped blocks (views/components) must come after `style` so their no-restricted-syntax
// wins for those files (flat config does not merge that rule); prettier comes last to disable
// formatting rules from earlier configs.

import { defineConfig } from 'eslint/config'
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier'

import { ignores, base } from './eslint/base.mjs'
import { style, allowDefaultExport, allowThrowInInvariant } from './eslint/style.mjs'
import {
  architecture,
  rendererNoMainImports,
  domainNoSharedImports,
  views,
  noDirectIpcInComponents
} from './eslint/architecture.mjs'
import { limits } from './eslint/limits.mjs'
import { comments } from './eslint/comments.mjs'
import { effect } from './eslint/effect.mjs'
import { react } from './eslint/react.mjs'

export default defineConfig(
  // Report (and fail on) eslint-disable directives that are not actually suppressing anything.
  // Note: this only catches *unused* directives. Banning live `eslint-disable` / `eslint-disable-next-line`
  // outright requires eslint-plugin-eslint-comments (no-unlimited-disable, no-use), not installed.
  { linterOptions: { reportUnusedDisableDirectives: 'error' } },
  ignores,
  ...base,
  style,
  allowDefaultExport,
  architecture,
  rendererNoMainImports,
  domainNoSharedImports,
  limits,
  comments,
  effect,
  react,
  views,
  noDirectIpcInComponents,
  allowThrowInInvariant,
  eslintConfigPrettier
)
