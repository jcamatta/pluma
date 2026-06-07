// Ambient global types for the preload bridge. This file has no top-level import/export, so its
// `declare global` is a true global augmentation visible to every file in the program (including
// index.ts, which assigns these onto window in the non-isolated fallback). The wire types are derived
// from the shared IPC contract via inline `import('...')`, so the file stays script-global rather than
// a module and there is no second, hand-mirrored copy of the API surface to keep in sync.

interface Window {
  electron: import('@electron-toolkit/preload').ElectronAPI
  api: import('../shared/ipc/window-api').WindowApi
}
