// The "main process": the brain of the app. It starts VAIA, creates the
// window, and answers requests coming from the UI.
import { BrowserWindow, app, ipcMain } from 'electron'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { Action, MenuItem } from '../shared/api'
import type { Pane, Rect } from '../shared/types'
import { Browser } from './browser'
import { buildMenu, popupMenu } from './menu'

app.setName('VAIA')
// Keep your data in ~/Library/Application Support/VAIA (tests can point elsewhere).
app.setPath('userData', process.env.VAIA_USER_DATA || join(app.getPath('appData'), 'VAIA'))

const browser = new Browser()

ipcMain.handle('state:get', () => browser.store.snapshot())
ipcMain.handle('action', (_e, action: Action) => browser.dispatch(action))
ipcMain.handle('capture', (_e, tabIds: string[]) => browser.capture(tabIds))
ipcMain.handle('suggest', (_e, query: string) => browser.suggest(query))
ipcMain.handle('history:search', (_e, query: string) => browser.history.search(query))
ipcMain.handle('history:list', (_e, query: string) => browser.history.list(query))
ipcMain.on('window:traffic-lights', (e, visible: boolean) => {
  BrowserWindow.fromWebContents(e.sender)?.setWindowButtonVisibility(visible)
})
ipcMain.handle('archive:list', (_e, query: string) => browser.archive.list(query))
ipcMain.handle('menu:popup', (e, items: MenuItem[]) => popupMenu(e.sender, items))
ipcMain.on('panes:set', (e, panes: Pane[]) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  if (win) browser.setPanes(win, panes)
})
ipcMain.on('peek:rect', (e, rect: Rect | null) => {
  if (e.sender === browser.win?.webContents) browser.setPeekRect(rect)
})

// Links opened from other apps (when VAIA is the default browser). They can
// arrive before VAIA has finished starting, so hold on to them until it's ready.
const pendingLinks: string[] = []
app.on('open-url', (event, url) => {
  event.preventDefault()
  if (app.isReady()) browser.openExternalLink(url)
  else pendingLinks.push(url)
})
app.on('open-file', (event, path) => {
  event.preventDefault()
  const url = pathToFileURL(path).href
  if (app.isReady()) browser.openExternalLink(url)
  else pendingLinks.push(url)
})

app.setAboutPanelOptions({
  applicationName: 'VAIA',
  credits: 'A calm, sidebar-first browser for Mac.',
  copyright: '© 2026 Vanessa Minerva Lim'
})

app.whenReady().then(() => {
  // The installed app gets its icon from the bundle; while developing, show it in the Dock too.
  if (!app.isPackaged) app.dock?.setIcon(join(app.getAppPath(), 'build/icon.png'))
  buildMenu(browser)
  browser.init()
  browser.createWindow()
  for (const url of pendingLinks.splice(0)) browser.openExternalLink(url)

  // Check for tabs to auto-archive at start-up and then every minute.
  browser.autoArchive()
  setInterval(() => {
    browser.autoArchive()
    browser.purgeDoneTodos()
  }, 60_000)

  // macOS: clicking the Dock icon with no windows open makes a new one.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) browser.createWindow()
  })
})

app.on('before-quit', () => {
  browser.store.flush()
  browser.history.flush()
  browser.archive.flush()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
