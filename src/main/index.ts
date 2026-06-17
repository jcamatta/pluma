import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as Scope from 'effect/Scope'
import icon from '../../resources/icon.png?asset'
import { installApplicationMenu } from './menu'
import { registerAgent, registerIpc, registerWatch } from './ipc/register'
import { mainRuntime } from './runtime/main-runtime'

// The app-lifetime scope owns the folder watcher fiber and its OS subscription; closing it on quit
// releases them.
const appScope = Effect.runSync(Scope.make())

function createWindow(): BrowserWindow {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // Spellcheck Spanish and English together: a word is only flagged when it's wrong in BOTH
  // dictionaries, so Spanish prose stops getting underlined.
  mainWindow.webContents.session.setSpellCheckerLanguages(['es', 'en-US'])

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  installApplicationMenu()

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  // zoom: true keeps watchWindowShortcuts from preventing Ctrl/Cmd +/-/0, which would otherwise
  // swallow the zoom keystrokes before the View-menu accelerators could act.
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window, { zoom: true })
  })

  registerIpc()

  const mainWindow = createWindow()
  registerWatch({ window: mainWindow, scope: appScope })
  registerAgent(mainWindow)

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      const window = createWindow()
      registerWatch({ window, scope: appScope })
      registerAgent(window)
    }
  })
})

// Release app-lifetime resources on quit: closing the scope interrupts the folder watcher, releasing
// its OS subscription and PubSub.
app.on('before-quit', () => {
  Effect.runFork(Scope.close(appScope, Exit.void))
  void mainRuntime.dispose()
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
