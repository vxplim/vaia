// The "main process": the brain of the app. It starts VAIA, creates the
// window, and answers requests coming from the UI.
import { BrowserWindow, app, ipcMain } from 'electron'
import { join } from 'node:path'
import type { Action } from '../shared/api'
import type { Pane } from '../shared/types'
import { Browser } from './browser'
import { buildMenu } from './menu'

app.setName('VAIA')
// Keep your data in ~/Library/Application Support/VAIA (tests can point elsewhere).
app.setPath('userData', process.env.VAIA_USER_DATA || join(app.getPath('appData'), 'VAIA'))

const browser = new Browser()

ipcMain.handle('state:get', () => browser.store.snapshot())
ipcMain.handle('action', (_e, action: Action) => browser.dispatch(action))
ipcMain.on('panes:set', (e, panes: Pane[]) => {
  if (e.sender === browser.win?.webContents) browser.setPanes(panes)
})

app.whenReady().then(() => {
  buildMenu(browser)
  browser.createWindow()

  // macOS: clicking the Dock icon with no windows open makes a new one.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) browser.createWindow()
  })
})

app.on('before-quit', () => browser.store.flush())

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
