// The Mac menu bar. Menu shortcuts work even while a web page has focus,
// which is why every VAIA keyboard shortcut lives here.
import { BrowserWindow, Menu, app, type MenuItemConstructorOptions, type WebContents } from 'electron'
import type { MenuItem } from '../shared/api'
import type { Browser } from './browser'

export function buildMenu(browser: Browser): void {
  const page = () => browser.focusedWebContents()
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
        { label: 'Settings…', id: 'settings', accelerator: 'CmdOrCtrl+,', click: () => browser.openSettings() },
        { type: 'separator' },
        {
          label: 'Make VAIA Your Default Browser',
          click: () => browser.dispatch({ type: 'app/makeDefaultBrowser' })
        },
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
        {
          label: 'New Split View Pane…',
          id: 'split',
          accelerator: 'Ctrl+Shift+=',
          click: () => browser.command({ type: 'command-bar', mode: 'split' })
        },
        {
          label: 'New Little Window',
          id: 'little',
          accelerator: 'CmdOrCtrl+Alt+N',
          click: () => browser.openLittle()
        },
        {
          label: 'New Private Window',
          id: 'private',
          accelerator: 'CmdOrCtrl+Shift+N',
          click: () => browser.openLittle('', true)
        },
        {
          label: 'Open Location…',
          id: 'focus-url',
          accelerator: 'CmdOrCtrl+L',
          click: () => {
            const little = browser.focusedLittle()
            if (little) little.win.webContents.send('ui:command', { type: 'focus-url' })
            else browser.command({ type: 'focus-url' })
          }
        },
        {
          label: 'Copy URL',
          id: 'copy-url',
          accelerator: 'CmdOrCtrl+Shift+C',
          click: withTab((id) => browser.dispatch({ type: 'tab/copyUrl', id }))
        },
        { type: 'separator' },
        {
          label: 'Close Tab',
          id: 'close-tab',
          accelerator: 'CmdOrCtrl+W',
          click: () => {
            const little = browser.focusedLittle()
            if (little) return little.win.close()
            if (browser.store.peek) return browser.closePeek()
            withTab((id) => browser.closeTab(id))()
          }
        },
        { label: 'Close Window', accelerator: 'CmdOrCtrl+Shift+W', role: 'close' },
        { type: 'separator' },
        {
          label: 'Print…',
          id: 'print',
          accelerator: 'CmdOrCtrl+P',
          click: () => {
            const little = browser.focusedLittle()
            const id = little ? little.tab.id : browser.activeTabId()
            if (id) browser.print(id)
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'pasteAndMatchStyle' },
        { role: 'selectAll' },
        { type: 'separator' },
        { label: 'Find…', id: 'find', accelerator: 'CmdOrCtrl+F', click: () => browser.command({ type: 'find' }) },
        {
          label: 'Find Next',
          accelerator: 'CmdOrCtrl+G',
          click: () => browser.notify({ type: 'find-next', forward: true })
        },
        {
          label: 'Find Previous',
          accelerator: 'CmdOrCtrl+Shift+G',
          click: () => browser.notify({ type: 'find-next', forward: false })
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Sidebar',
          id: 'toggle-sidebar',
          accelerator: 'CmdOrCtrl+S',
          click: () => browser.notify({ type: 'toggle-sidebar' })
        },
        { label: 'Boost This Site…', id: 'boost', click: () => browser.command({ type: 'boost' }) },
        { label: 'Capture…', id: 'capture', accelerator: 'CmdOrCtrl+Shift+2', click: () => browser.command({ type: 'capture' }) },
        { label: 'Library', id: 'library', accelerator: 'CmdOrCtrl+Shift+L', click: () => browser.command({ type: 'open-library' }) },
        { label: 'Downloads', id: 'downloads', accelerator: 'CmdOrCtrl+Shift+J', click: () => browser.command({ type: 'open-library', section: 'downloads' }) },
        { label: 'To-do List', id: 'todo', accelerator: 'CmdOrCtrl+Shift+K', click: () => browser.command({ type: 'open-panel', panel: 'todo' }) },
        { label: 'Tidy Today Tabs', id: 'tidy', click: () => browser.tidy() },
        { label: 'Extensions…', id: 'extensions', click: () => browser.openSettings() },
        { type: 'separator' },
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
        { label: 'Forward', id: 'forward', accelerator: 'CmdOrCtrl+]', click: () => page()?.navigationHistory.goForward() },
        { type: 'separator' },
        {
          label: 'Reopen Closed Tab',
          id: 'reopen-closed',
          accelerator: 'CmdOrCtrl+Shift+T',
          click: () => browser.reopenClosed()
        },
        { label: 'Show All History', id: 'history', accelerator: 'CmdOrCtrl+Y', click: () => browser.command({ type: 'open-panel', panel: 'history' }) },
        { label: 'Archive…', id: 'archive', click: () => browser.command({ type: 'open-library', section: 'archive' }) }
      ]
    },
    {
      label: 'Spaces',
      submenu: [
        {
          label: 'New Space',
          id: 'new-space',
          click: () => {
            const id = browser.dispatch({ type: 'space/new' }) as string
            browser.command({ type: 'edit-space', id, setup: true })
          }
        },
        {
          label: 'Edit Space…',
          id: 'edit-space',
          click: () => browser.command({ type: 'edit-space', id: browser.state.activeSpaceId })
        },
        { type: 'separator' },
        {
          label: 'Next Space',
          click: () => browser.dispatch({ type: 'space/switchRelative', delta: 1 })
        },
        {
          label: 'Previous Space',
          click: () => browser.dispatch({ type: 'space/switchRelative', delta: -1 })
        },
        { type: 'separator' },
        ...Array.from({ length: 9 }, (_, i) => ({
          label: `Space ${i + 1}`,
          id: `space-${i + 1}`,
          accelerator: `Ctrl+${i + 1}`,
          click: () => browser.dispatch({ type: 'space/switchIndex', index: i })
        }))
      ]
    },
    { role: 'windowMenu' }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function toNative(item: MenuItem, choose: (id: string | null) => void): MenuItemConstructorOptions {
  if (item.type === 'separator') return { type: 'separator' }
  if (item.submenu) return { label: item.label, enabled: item.enabled ?? true, submenu: item.submenu.map((i) => toNative(i, choose)) }
  return {
    label: item.label,
    enabled: item.enabled ?? true,
    ...(item.checked !== undefined ? { type: 'checkbox' as const, checked: item.checked } : {}),
    click: () => choose(item.id ?? null)
  }
}

/** A native right-click menu requested by the UI. Native menus can float over web pages. */
export function popupMenu(sender: WebContents, items: MenuItem[]): Promise<string | null> {
  return new Promise((resolve) => {
    let done = false
    const finish = (value: string | null) => {
      if (!done) {
        done = true
        resolve(value)
      }
    }
    const menu = Menu.buildFromTemplate(
      items.map((item) =>
        item.type === 'separator'
          ? { type: 'separator' as const }
          : toNative(item, finish)
      )
    )
    menu.popup({
      window: BrowserWindow.fromWebContents(sender) ?? undefined,
      // The close callback can arrive before the click; wait a tick so a click wins.
      callback: () => setTimeout(() => finish(null), 50)
    })
  })
}
