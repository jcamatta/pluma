// Vitest configuration. Two projects: backend tests (domain calculations, use cases) run in node;
// renderer tests (hooks, views) run in jsdom. A coverage gate fails the build on untested logic.

import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: [
            'src/main/**/*.{test,spec}.ts',
            'src/preload/**/*.{test,spec}.ts',
            'e2e/**/*.{test,spec}.ts'
          ]
        }
      },
      {
        extends: true,
        test: {
          name: 'renderer',
          environment: 'jsdom',
          include: ['src/renderer/**/*.{test,spec}.{ts,tsx}']
        }
      }
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.{test,spec}.{ts,tsx}',
        'src/**/*.d.ts',
        'src/preload/**',
        'src/**/index.ts',
        'src/**/main.tsx'
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80
      }
    }
  }
})
