// The "main process": the brain of the app. It runs in Node.js, creates
// windows, and (in later phases) manages tabs and saves your data.
import { app, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 720,
    minHeight: 480,
    title: 'VAIA',
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#f4f1ec',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // Security best practices: the UI cannot touch Node.js directly.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  win.once('ready-to-show', () => win.show())

  // Never let the app UI itself navigate away or open random windows;
  // send any outside links to the user's default browser for now.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // In development, load the live-reloading dev server; otherwise the built file.
  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.setName('VAIA')

app.whenReady().then(() => {
  createMainWindow()

  // macOS: clicking the Dock icon with no windows open makes a new one.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
