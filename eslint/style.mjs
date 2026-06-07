// Functional style and type-safety rules enforced project-wide: no let/var, no global mutable state,
// no input mutation, no type assertions or ts-comment escape hatches, export discipline.

import importX from 'eslint-plugin-import-x'

// Shared no-restricted-syntax selectors. Flat config does not merge this rule across overlapping
// configs (the last one wins), so any scoped block that adds selectors must spread these in too.
export const baseRestrictedSyntax = [
  {
    selector: "VariableDeclaration[kind='let']",
    message:
      'let is forbidden. Use const and model change through new values, recursion, or Effect.'
  },
  {
    selector: "FunctionDeclaration > BlockStatement AssignmentExpression[left.type='Identifier']",
    message:
      'Avoid reassigning module/global variables. Pass state explicitly or use an Effect service.'
  },
  {
    selector: "TSAsExpression:not([typeAnnotation.typeName.name='const'])",
    message:
      'Type assertions (`x as T`) are forbidden except `as const`. Type the value properly or narrow it.'
  },
  {
    selector: 'TSTypeAssertion',
    message: 'Angle-bracket type assertions (`<T>x`) are forbidden. Type the value properly.'
  },
  {
    selector: 'ThrowStatement',
    message:
      'throw is forbidden. Return a Result ({ ok: false, error }) for recoverable failures, or in Effect code fail with a typed error. For unrecoverable wiring invariants use invariant() from src/shared/invariant.ts.'
  }
]

export const style = {
  files: ['**/*.{ts,tsx}'],
  plugins: {
    'import-x': importX
  },
  rules: {
    // No reassignment and no var: const only. Model change through new values, recursion, or Effect.
    'no-var': 'error',
    'prefer-const': 'error',
    'no-restricted-syntax': ['error', ...baseRestrictedSyntax],

    // Export discipline: prefer named exports (one responsibility per file). True "single export"
    // cannot be expressed by a built-in rule; banning default exports steers toward it.
    'import-x/no-default-export': 'error',
    'import-x/group-exports': 'error',

    // No mutation of inputs: keeps Data immutable in practice and functions pure.
    'no-param-reassign': ['error', { props: true }],

    // Close the type-safety holes that no-explicit-any and type-coverage miss.
    // ts-ignore / ts-expect-error / ts-nocheck cannot silence the type-checker. Override the looser
    // electron-toolkit default (which allows ts-ignore with a description) to ban all three outright.
    '@typescript-eslint/ban-ts-comment': [
      'error',
      { 'ts-ignore': true, 'ts-expect-error': true, 'ts-nocheck': true, 'ts-check': false }
    ],
    // No non-null assertions (`x!`); narrow properly instead.
    '@typescript-eslint/no-non-null-assertion': 'error',

    // No console: logging is an action that does not belong scattered in code. Surface failures as
    // values (Result) or through an explicit logging port.
    'no-console': 'error'
  }
}

// The one file allowed to throw: the sanctioned invariant helper. The global ThrowStatement ban is
// re-applied here without that selector so this file (and only this file) may throw.
export const allowThrowInInvariant = {
  files: ['src/shared/invariant.ts'],
  rules: {
    'no-restricted-syntax': [
      'error',
      ...baseRestrictedSyntax.filter((rule) => rule.selector !== 'ThrowStatement')
    ]
  }
}

// Files that legitimately need a default export (entry points, some configs, React refresh boundaries).
export const allowDefaultExport = {
  files: ['**/main.tsx', '**/index.html', '*.config.{ts,mjs,js}', 'electron.vite.config.ts'],
  rules: {
    'import-x/no-default-export': 'off'
  }
}
