// The Mac menu bar. Menu shortcuts work even while a web page has focus,
// which is why every VAIA keyboard shortcut lives here.
import { Menu, app, type MenuItemConstructorOptions } from 'electron'
import type { Browser } from './browser'

export function buildMenu(browser: Browser): void {
  const page = () => browser.activeWebContents()
  const withTab = (fn: (id: string) => void) => () => {
    const id = browser.activeTabId()
    if (id) fn(id)
  }
  const zoom = (delta: number | null) => () => {
    const wc = page()
    if (wc) wc.setZoomLevel(delta === null ? 0 : wc.getZoomLevel() + delta)
  }

  const template: MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about', label: 'About VAIA' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide', label: 'Hide VAIA' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit', label: 'Quit VAIA' }
      ]
    },
    {
      label: 'File',
      submenu: [
        { label: 'New Tab', id: 'new-tab', accelerator: 'CmdOrCtrl+T', click: () => browser.command({ type: 'command-bar' }) },
        { label: 'Open Location…', id: 'focus-url', accelerator: 'CmdOrCtrl+L', click: () => browser.command({ type: 'focus-url' }) },
        {
          label: 'Copy URL',
          id: 'copy-url',
          accelerator: 'CmdOrCtrl+Shift+C',
          click: withTab((id) => browser.dispatch({ type: 'tab/copyUrl', id }))
        },
        { type: 'separator' },
        { label: 'Close Tab', id: 'close-tab', accelerator: 'CmdOrCtrl+W', click: withTab((id) => browser.closeTab(id)) },
        { label: 'Close Window', accelerator: 'CmdOrCtrl+Shift+W', role: 'close' }
      ]
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { label: 'Reload Page', id: 'reload', accelerator: 'CmdOrCtrl+R', click: () => page()?.reload() },
        { label: 'Hard Reload Page', accelerator: 'CmdOrCtrl+Shift+R', click: () => page()?.reloadIgnoringCache() },
        { type: 'separator' },
        { label: 'Actual Size', accelerator: 'CmdOrCtrl+0', click: zoom(null) },
        { label: 'Zoom In', accelerator: 'CmdOrCtrl+=', click: zoom(0.5) },
        { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', click: zoom(-0.5) },
        { type: 'separator' },
        { label: 'Developer Tools', accelerator: 'Alt+CmdOrCtrl+I', click: () => page()?.toggleDevTools() },
        {
          label: 'VAIA Interface Developer Tools',
          click: () => browser.win?.webContents.toggleDevTools()
        },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'History',
      submenu: [
        { label: 'Back', id: 'back', accelerator: 'CmdOrCtrl+[', click: () => page()?.navigationHistory.goBack() },
        { label: 'Forward', id: 'forward', accelerator: 'CmdOrCtrl+]', click: () => page()?.navigationHistory.goForward() }
      ]
    },
    { role: 'windowMenu' }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
