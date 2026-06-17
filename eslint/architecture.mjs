// Hexagonal architecture boundaries: dependencies point inward (ipc -> application),
// adapters are never imported by the application, and the renderer never reaches into main internals.

import importX from 'eslint-plugin-import-x'
import { baseRestrictedSyntax } from './style.mjs'

export const architecture = {
  files: ['src/**/*.{ts,tsx}'],
  plugins: {
    'import-x': importX
  },
  rules: {
    'import-x/no-restricted-paths': [
      'error',
      {
        zones: [
          // Application is the core: it depends on ports it defines, never on concrete adapters
          // or the ipc layer.
          {
            target: './src/main/application',
            from: ['./src/main/adapters', './src/main/ipc']
          },
          // src/shared/ipc is the API/wire layer: the contract main and the renderer agree on. Only
          // the ipc layer (and the preload bridge) may translate to and from it. The application and
          // adapters layers stay pure domain — they must not import shared; the ipc handlers map
          // between the domain types and the wire contract at the boundary.
          {
            target: ['./src/main/application', './src/main/adapters'],
            from: ['./src/shared']
          },
          // The renderer must not import main-process internals; it talks through preload/IPC only.
          {
            target: './src/renderer',
            from: ['./src/main']
          }
        ]
      }
    ]
  }
}

// The renderer must never reach into main-process code: it talks to main only through the preload
// `window.api` bridge. The import-x/no-restricted-paths zone above is the architectural rule, but it
// only fires for imports a resolver can resolve to a file; this no-restricted-imports block is a
// resolver-free backstop that bans the import *specifier* by glob, so a relative path into src/main
// is rejected regardless of resolver configuration.
export const rendererNoMainImports = {
  files: ['src/renderer/**/*.{ts,tsx}'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            // Matches any specifier with a `main/` path segment (e.g. ../../../main/...) at any
            // depth, while leaving package imports like @ag-ui/core untouched. Uses regex because
            // minimatch globs do not span the leading `../` segments of a relative specifier.
            regex: '(^|/)main/',
            message:
              'The renderer must not import main-process code. Talk to main through the preload window.api bridge; declare the wire types on the renderer side.'
          }
        ]
      }
    ]
  }
}

// src/shared/ipc is the API/wire layer. Only the ipc layer (and the preload bridge) may translate to
// and from it; the application and adapters layers stay pure domain. The no-restricted-paths zone
// above states this, but — like the renderer rule — it only fires when a resolver can resolve the
// import to a file, and none is configured. This resolver-free backstop bans the import *specifier* by
// regex, so any relative path into src/shared from application/adapters is rejected regardless of
// resolver configuration.
export const domainNoSharedImports = {
  files: ['src/main/application/**/*.ts', 'src/main/adapters/**/*.ts'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            // Matches any specifier with a `shared/` path segment (e.g. ../../../shared/...) at any
            // depth, while leaving package imports untouched.
            regex: '(^|/)shared/',
            message:
              'The application and adapters layers must not import src/shared. shared/ipc is the API/wire layer; only the ipc handlers may map between the domain types and the wire contract.'
          }
        ]
      }
    ]
  }
}

// The renderer must not reach across the component tree from `document` — querySelector(All) or
// getElementById — to find and drive another component's DOM. That couples the caller to incidental
// markup (often an e2e hook), with no type-safety, and breaks silently when the markup changes. To drive
// a sibling component imperatively, register a handle through a context and call it — see
// ComposerFocusContext / ActiveEditorContext. Two exceptions: tests, which legitimately query the
// rendered DOM to assert on it, and main.tsx, which getElementById's the React mount root. Untouched
// either way: element-scoped queries (`container.querySelector`, `editor.view.dom.querySelector`), whose
// object is not `document`.
export const rendererNoDomTreeReaching = {
  files: ['src/renderer/**/*.{ts,tsx}'],
  ignores: [
    'src/renderer/**/__tests__/**',
    'src/renderer/**/*.test.{ts,tsx}',
    'src/renderer/**/main.tsx'
  ],
  rules: {
    'no-restricted-properties': [
      'error',
      {
        object: 'document',
        property: 'querySelector',
        message:
          'Do not reach across the component tree with document.querySelector. Register an imperative handle through a context (e.g. ComposerFocusContext, ActiveEditorContext) and call it.'
      },
      {
        object: 'document',
        property: 'querySelectorAll',
        message:
          'Do not reach across the component tree with document.querySelectorAll. Register an imperative handle through a context (e.g. ComposerFocusContext, ActiveEditorContext) and call it.'
      },
      {
        object: 'document',
        property: 'getElementById',
        message:
          'Do not look up elements by id with document.getElementById in the renderer. Register an imperative handle through a context (e.g. ComposerFocusContext, ActiveEditorContext) and call it. The only exception, the React mount root, lives in main.tsx.'
      }
    ]
  }
}

// Views are pure layout: no hooks (no use* calls) and no direct IPC. A view that needs data must
// receive it through props from its controller.
export const views = {
  files: ['src/renderer/**/*.view.tsx'],
  rules: {
    'no-restricted-syntax': [
      'error',
      ...baseRestrictedSyntax,
      {
        selector: 'CallExpression[callee.name=/^use[A-Z]/]',
        message:
          'Views must not call hooks. Move side effects to the matching *.controller.tsx and pass data via props.'
      },
      {
        selector: "MemberExpression[object.name='window'][property.name='api']",
        message:
          'Views must not touch window.api. Data comes from props, supplied by the controller.'
      }
    ]
  }
}

// Hooks and plain modules (.ts) must reach IPC through a port, not the window.api bridge — the same
// boundary the .tsx rule below enforces for components, which it could not see because it only matches
// .tsx. Only the renderer adapters own window.api; a hook gets its data from a port via useRepos (see
// folder-repository.ipc / RepositoriesContext). The selector bans a *call* on window.api
// (`window.api.invoke(...)`), which is the leak, while leaving the injected-seam default a hook may
// declare (`api: WindowApi = window.api`) — already swappable and faked in tests — untouched.
export const noDirectIpcInModules = {
  files: ['src/renderer/**/*.ts'],
  ignores: ['src/renderer/**/adapters/**', 'src/renderer/**/__tests__/**', 'src/renderer/**/*.test.ts'],
  rules: {
    'no-restricted-syntax': [
      'error',
      ...baseRestrictedSyntax,
      {
        selector:
          "CallExpression[callee.object.object.name='window'][callee.object.property.name='api']",
        message:
          'Only renderer adapters may call window.api. A hook gets its data from a port (see useRepos / RepositoriesContext); declare the port and route the call through the adapter.'
      }
    ]
  }
}

// Plain/visual components and views never reach IPC directly. Only controllers (via hooks) and the
// renderer adapters may use window.api. This block bans window.api in renderer components that are
// neither controllers nor adapters.
export const noDirectIpcInComponents = {
  files: ['src/renderer/**/*.tsx'],
  ignores: [
    'src/renderer/**/*.view.tsx',
    'src/renderer/**/*.controller.tsx',
    'src/renderer/**/adapters/**'
  ],
  rules: {
    'no-restricted-syntax': [
      'error',
      ...baseRestrictedSyntax,
      {
        selector: "MemberExpression[object.name='window'][property.name='api']",
        message:
          'Only controllers (through hooks) and renderer adapters may use window.api. Get data via props or a hook.'
      }
    ]
  }
}
