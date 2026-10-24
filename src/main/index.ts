// The "main process": the brain of the app. It starts VAIA, creates the
// window, and answers requests coming from the UI.
import { BrowserWindow, app, ipcMain, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron'
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

/**
 * Requests from VAIA's own windows (sidebar, Settings, …) only. Web pages and extension
 * popups can never reach these, even if a page found a way to send messages.
 */
function fromUi(e: IpcMainEvent | IpcMainInvokeEvent): boolean {
  const ok = BrowserWindow.getAllWindows().some((w) => w.webContents === e.sender) && isUiUrl(e.sender.getURL())
  if (!ok) console.warn('[ipc] ignored a request from outside VAIA’s interface')
  return ok
}
function isUiUrl(url: string): boolean {
  const dev = process.env.ELECTRON_RENDERER_URL
  return (!!dev && url.startsWith(dev)) || url.startsWith(pathToFileURL(join(__dirname, '../renderer/index.html')).href)
}
const ui =
  <A extends unknown[], R>(fn: (e: IpcMainInvokeEvent, ...args: A) => R) =>
  (e: IpcMainInvokeEvent, ...args: A) =>
    fromUi(e) ? fn(e, ...args) : Promise.reject(new Error('Not allowed'))
const uiEvent =
  <A extends unknown[]>(fn: (e: IpcMainEvent, ...args: A) => void) =>
  (e: IpcMainEvent, ...args: A) => {
    if (fromUi(e)) fn(e, ...args)
  }

ipcMain.handle('state:get', ui(() => browser.store.snapshot()))
ipcMain.handle('action', ui((_e, action: Action) => browser.dispatch(action)))
ipcMain.handle('capture', ui((_e, tabIds: string[]) => browser.capture(tabIds)))
ipcMain.handle('suggest', ui((_e, query: string) => browser.suggest(query)))
ipcMain.handle('history:search', ui((_e, query: string) => browser.history.search(query)))
ipcMain.handle('history:list', ui((_e, query: string) => browser.history.list(query)))
ipcMain.on(
  'window:traffic-lights',
  uiEvent((e, visible: boolean) => {
    BrowserWindow.fromWebContents(e.sender)?.setWindowButtonVisibility(visible)
  })
)
ipcMain.handle('archive:list', ui((_e, query: string) => browser.archive.list(query)))
ipcMain.handle('menu:popup', ui((e, items: MenuItem[]) => popupMenu(e.sender, items)))
ipcMain.handle('download:thumbnail', ui((_e, id: string) => browser.downloadThumbnail(id)))
// Passwords: the list for Settings, and the login helper running inside web pages.
ipcMain.handle('passwords:list', ui(() => browser.passwords.list()))
ipcMain.handle('pw:lookup', (e, origin: string) => browser.lookupLogins(e, origin))
ipcMain.on('pw:submitted', (e, login: { origin: string; username: string; password: string }) => browser.loginSubmitted(e, login))
ipcMain.on('pw:username', (e, info: { origin: string; username: string }) => browser.loginUsername(e, info))
ipcMain.on(
  'panes:set',
  uiEvent((e, panes: Pane[]) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (win) browser.setPanes(win, panes)
  })
)
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
