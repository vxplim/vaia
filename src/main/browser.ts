// The heart of VAIA: owns the main window, the web page views, and every
// action the UI can ask for (open tab, close tab, navigate, ...).
import {
  BrowserWindow,
  Menu,
  WebContentsView,
  clipboard,
  session,
  shell,
  type ContextMenuParams,
  type Session
} from 'electron'
import { join } from 'node:path'
import type { Action } from '../shared/api'
import { activeSpace, locate } from '../shared/tree'
import type { Pane, TabItem, UiCommand } from '../shared/types'
import { inputToUrl } from '../shared/url'
import { Store, newId } from './store'

const PRELOAD = join(__dirname, '../preload/index.js')

/** Remove "Electron/x" and "VAIA/x" from the user agent so sites treat us like Chrome. */
function cleanUserAgent(ses: Session): void {
  ses.setUserAgent(ses.getUserAgent().replace(/\s(Electron|vaia|VAIA)\/\S+/g, ''))
}

export function loadUi(win: BrowserWindow, view = ''): void {
  const query = view ? `?view=${view}` : ''
  const loading = process.env.ELECTRON_RENDERER_URL
    ? win.loadURL(`${process.env.ELECTRON_RENDERER_URL}${query}`)
    : win.loadFile(join(__dirname, '../renderer/index.html'), { search: query })
  loading.catch((err) => console.error('[ui] failed to load', err))
}

export class Browser {
  win: BrowserWindow | null = null
  readonly store = new Store()
  private views = new Map<string, WebContentsView>()
  private attached: string[] = []
  private focusOnAttach: string | null = null
  private configuredSessions = new Set<Session>()

  get state() {
    return this.store.state
  }

  // ---------- Window ----------

  createWindow(): BrowserWindow {
    const win = new BrowserWindow({
      width: 1360,
      height: 860,
      minWidth: 720,
      minHeight: 480,
      title: 'VAIA',
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 16, y: 18 },
      vibrancy: 'sidebar',
      visualEffectState: 'active',
      backgroundColor: '#00000000',
      show: false,
      webPreferences: {
        preload: PRELOAD,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    })
    this.win = win
    this.store.subscribe(win.webContents)
    // The UI is laid out in exact pixels to line up with web pages; don't let it zoom.
    win.webContents.on('did-finish-load', () => win.webContents.setVisualZoomLevelLimits(1, 1).catch(() => {}))
    win.webContents.on('before-input-event', (event, input) => {
      if (input.meta && ['=', '+', '-', '0'].includes(input.key)) event.preventDefault()
    })
    win.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url)
      return { action: 'deny' }
    })
    win.webContents.on('will-navigate', (e) => e.preventDefault())
    win.once('ready-to-show', () => win.show())
    win.on('closed', () => {
      for (const view of this.views.values()) view.webContents.close()
      this.views.clear()
      this.attached = []
      this.win = null
    })
    loadUi(win)
    return win
  }

  /** Send a command to the main window's UI, focusing it first. */
  command(cmd: UiCommand): void {
    if (!this.win) return
    this.win.webContents.focus()
    this.win.webContents.send('ui:command', cmd)
  }

  // ---------- Web page views ----------

  private sessionFor(_tabId: string): Session {
    const ses = session.fromPartition('persist:default')
    if (!this.configuredSessions.has(ses)) {
      this.configuredSessions.add(ses)
      cleanUserAgent(ses)
    }
    return ses
  }

  private ensureView(tab: TabItem): WebContentsView {
    let view = this.views.get(tab.id)
    if (view) return view
    view = new WebContentsView({
      webPreferences: {
        session: this.sessionFor(tab.id),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    })
    view.setBorderRadius(10)
    view.setBackgroundColor('#ffffff')
    this.views.set(tab.id, view)
    this.wireView(tab.id, view)
    if (tab.url) view.webContents.loadURL(tab.url).catch(() => {})
    return view
  }

  private wireView(tabId: string, view: WebContentsView): void {
    const wc = view.webContents
    const runtime = () => {
      this.store.runtime[tabId] = {
        loading: wc.isLoading(),
        canGoBack: wc.navigationHistory.canGoBack(),
        canGoForward: wc.navigationHistory.canGoForward()
      }
      this.store.changed(false)
    }
    wc.on('page-title-updated', (_e, title) => this.updateTab(tabId, { title }))
    wc.on('page-favicon-updated', (_e, icons) => {
      if (icons[0]) this.updateTab(tabId, { favicon: icons[0] })
    })
    wc.on('did-navigate', (_e, url) => {
      const tab = this.tab(tabId)
      const patch: Partial<TabItem> = { url }
      if (tab && originOf(tab.url) !== originOf(url)) patch.favicon = undefined
      this.updateTab(tabId, patch)
      runtime()
    })
    wc.on('did-navigate-in-page', (_e, url, isMainFrame) => {
      if (isMainFrame) this.updateTab(tabId, { url })
      runtime()
    })
    wc.on('did-start-loading', runtime)
    wc.on('did-stop-loading', runtime)
    wc.setWindowOpenHandler(({ url, disposition }) => {
      // Real popups (e.g. "Sign in with Google") need to stay popups.
      if (disposition === 'new-window') return { action: 'allow' }
      this.newTab(url, disposition !== 'background-tab', tabId)
      return { action: 'deny' }
    })
    wc.on('context-menu', (_e, params) => this.pageMenu(tabId, params))
  }

  private destroyView(tabId: string): void {
    const view = this.views.get(tabId)
    if (!view) return
    if (this.win && this.attached.includes(tabId)) this.win.contentView.removeChildView(view)
    this.attached = this.attached.filter((id) => id !== tabId)
    view.webContents.close()
    this.views.delete(tabId)
    delete this.store.runtime[tabId]
  }

  /** The UI tells us exactly which pages should be visible and where. */
  setPanes(panes: Pane[]): void {
    const win = this.win
    if (!win) return
    const wanted = panes.map((p) => p.tabId)
    for (const id of this.attached) {
      if (!wanted.includes(id)) {
        const view = this.views.get(id)
        if (view) win.contentView.removeChildView(view)
      }
    }
    for (const pane of panes) {
      const tab = this.tab(pane.tabId)
      if (!tab) continue
      const view = this.ensureView(tab)
      const r = pane.rect
      view.setBounds({
        x: Math.round(r.x),
        y: Math.round(r.y),
        width: Math.max(0, Math.round(r.width)),
        height: Math.max(0, Math.round(r.height))
      })
      if (!this.attached.includes(pane.tabId)) win.contentView.addChildView(view)
    }
    this.attached = wanted.filter((id) => this.views.has(id))
    if (this.focusOnAttach && this.attached.includes(this.focusOnAttach)) {
      this.views.get(this.focusOnAttach)?.webContents.focus()
      this.focusOnAttach = null
    }
  }

  private pageMenu(tabId: string, p: ContextMenuParams): void {
    const wc = this.views.get(tabId)?.webContents
    if (!wc) return
    const items: Electron.MenuItemConstructorOptions[] = []
    if (p.linkURL) {
      items.push(
        { label: 'Open Link in New Tab', click: () => this.newTab(p.linkURL, false, tabId) },
        { label: 'Copy Link', click: () => clipboard.writeText(p.linkURL) },
        { type: 'separator' }
      )
    }
    if (p.hasImageContents && p.srcURL) {
      items.push(
        { label: 'Open Image in New Tab', click: () => this.newTab(p.srcURL, false, tabId) },
        { label: 'Copy Image', click: () => wc.copyImageAt(p.x, p.y) },
        { type: 'separator' }
      )
    }
    if (p.isEditable) items.push({ role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { type: 'separator' })
    else if (p.selectionText) items.push({ role: 'copy' }, { type: 'separator' })
    items.push(
      { label: 'Back', enabled: wc.navigationHistory.canGoBack(), click: () => wc.navigationHistory.goBack() },
      { label: 'Forward', enabled: wc.navigationHistory.canGoForward(), click: () => wc.navigationHistory.goForward() },
      { label: 'Reload', click: () => wc.reload() },
      { type: 'separator' },
      { label: 'Inspect Element', click: () => wc.inspectElement(p.x, p.y) }
    )
    Menu.buildFromTemplate(items).popup()
  }

  // ---------- Helpers ----------

  tab(id: string): TabItem | null {
    const loc = locate(this.state, id)
    return loc && loc.item.kind === 'tab' ? loc.item : null
  }

  activeTabId(): string | null {
    const space = activeSpace(this.state)
    if (!space.activeId) return null
    const loc = locate(this.state, space.activeId)
    if (!loc) return null
    if (loc.item.kind === 'tab') return loc.item.id
    if (loc.item.kind === 'split') return loc.item.tabs[0]?.id ?? null
    return null
  }

  activeWebContents(): Electron.WebContents | null {
    const id = this.activeTabId()
    return id ? (this.views.get(id)?.webContents ?? null) : null
  }

  private updateTab(id: string, patch: Partial<TabItem>): void {
    const tab = this.tab(id)
    if (!tab) return
    Object.assign(tab, patch)
    this.store.changed()
  }

  // ---------- Actions ----------

  newTab(url = '', activate = true, openerId?: string): TabItem {
    const space = activeSpace(this.state)
    const now = Date.now()
    const tab: TabItem = { kind: 'tab', id: newId(), url, title: url || 'New Tab', createdAt: now, lastViewedAt: now }
    // Tabs opened from a link go right below the tab that opened them.
    const opener = openerId ? locate(this.state, openerId) : null
    if (opener && opener.zone === 'today' && opener.space === space && !opener.split) {
      opener.list.splice(opener.index + 1, 0, tab)
    } else {
      space.today.unshift(tab)
    }
    if (activate) this.activate(tab.id)
    this.store.changed()
    return tab
  }

  activate(id: string): void {
    const loc = locate(this.state, id)
    if (!loc) return
    const space = loc.space ?? activeSpace(this.state)
    // Clicking a tab inside a split shows the whole split.
    space.activeId = loc.split ? loc.split.id : id
    if (loc.item.kind === 'tab') {
      loc.item.lastViewedAt = Date.now()
      if (loc.item.url) this.focusOnAttach = id
    }
    this.store.changed()
  }

  closeTab(id: string): void {
    const loc = locate(this.state, id)
    if (!loc || loc.item.kind !== 'tab') return
    const space = loc.space ?? activeSpace(this.state)
    const wasActive = space.activeId === id
    loc.list.splice(loc.index, 1)
    this.destroyView(id)
    if (wasActive) {
      // Select the neighbour, preferring the one below.
      const next = loc.list[loc.index] ?? loc.list[loc.index - 1]
      space.activeId = next && next.kind !== 'folder' ? next.id : null
      if (next?.kind === 'tab') this.activate(next.id)
    }
    this.store.changed()
  }

  navigate(id: string, input: string): void {
    const url = inputToUrl(input, this.state.settings.searchEngine)
    const tab = this.tab(id)
    if (!url || !tab) return
    tab.url = url
    if (!tab.title || tab.title === 'New Tab') tab.title = url
    const view = this.views.get(id)
    if (view) {
      view.webContents.loadURL(url).catch(() => {})
      view.webContents.focus()
    } else {
      this.focusOnAttach = id
    }
    this.store.changed()
  }

  dispatch(action: Action): unknown {
    const wc = (id: string) => this.views.get(id)?.webContents
    switch (action.type) {
      case 'tab/new':
        return this.newTab(action.url).id
      case 'tab/activate':
        return this.activate(action.id)
      case 'tab/close':
        return this.closeTab(action.id)
      case 'tab/navigate':
        return this.navigate(action.id, action.input)
      case 'tab/back':
        return wc(action.id)?.navigationHistory.goBack()
      case 'tab/forward':
        return wc(action.id)?.navigationHistory.goForward()
      case 'tab/reload':
        return wc(action.id)?.reload()
      case 'tab/stop':
        return wc(action.id)?.stop()
      case 'settings/update':
        Object.assign(this.state.settings, action.patch)
        this.store.changed()
        return
    }
  }
}

function originOf(url: string): string {
  try {
    return new URL(url).origin
  } catch {
    return ''
  }
}
