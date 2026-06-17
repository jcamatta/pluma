import { Menu, type MenuItemConstructorOptions } from 'electron'

// Electron registers the zoom accelerators (Ctrl/Cmd +/-/0) only through an application menu, so the
// app must install one even though the bar stays hidden on Win/Linux via the window's
// autoHideMenuBar. The View submenu is built from the explicit zoom roles rather than the full
// `viewMenu` role, which would also expose Reload / Toggle DevTools to end users.
//
// On macOS setApplicationMenu replaces the entire menu and the bar is always visible, so the template
// must re-supply the standard menus (appMenu, editMenu, windowMenu) — omitting editMenu would regress
// Cmd+C/V/X/Z/A in a writing app.

const viewSubmenu: MenuItemConstructorOptions = {
  label: 'View',
  submenu: [{ role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }]
}

function buildMenuTemplate(platform: NodeJS.Platform): MenuItemConstructorOptions[] {
  return platform === 'darwin'
    ? [{ role: 'appMenu' }, { role: 'editMenu' }, viewSubmenu, { role: 'windowMenu' }]
    : [{ role: 'editMenu' }, viewSubmenu]
}

function installApplicationMenu(): void {
  Menu.setApplicationMenu(Menu.buildFromTemplate(buildMenuTemplate(process.platform)))
}

export { buildMenuTemplate, installApplicationMenu }
