// The agent feature's single reference to the preload window.api bridge, isolated in adapters/ so the
// provider and the tool bridge receive it injected rather than reaching the global. Keeping the one
// reference here is what lets the no-window.api-outside-adapters rule hold for the rest of the renderer.

import type { WindowApi } from '../../../../shared/ipc/window-api'

export function windowApi(): WindowApi {
  return window.api
}
