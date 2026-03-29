import { app, BrowserWindow, ipcMain, Notification, shell } from 'electron'
import { join } from 'path'
import { initDatabase } from './database'
import { registerIpcHandlers } from './ipc/index'

const isDev = !app.isPackaged

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 18 },
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    // Open DevTools in development so you can see console errors
    if (isDev) {
      mainWindow.webContents.openDevTools({ mode: 'detach' })
    }
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // initDatabase is now synchronous
  try {
    initDatabase()
  } catch (err) {
    console.error('[FATAL] Database failed to initialize:', err)
    // App will still open — renderer will show the error
  }

  registerIpcHandlers(ipcMain)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

ipcMain.on('show-notification', (_, { title, body }) => {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show()
  }
})
