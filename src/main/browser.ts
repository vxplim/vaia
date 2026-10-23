// The heart of VAIA: owns the main window, the web page views, and every
// action the UI can ask for (open tab, close tab, navigate, ...).
import {
  BrowserWindow,
  Menu,
  net,
  WebContentsView,
  clipboard,
  session,
  shell,
  type ContextMenuParams,
  type Session
} from 'electron'
import { join } from 'node:path'
import type { Action } from '../shared/api'
import { activeSpace, locate, tabsIn } from '../shared/tree'
import type { ArchivedTab, Pane, Space, TabItem, UiCommand } from '../shared/types'
import { SEARCH_ENGINES, inputToUrl } from '../shared/url'
import { ARCHIVE_AFTER_MS, Archive } from './archive'
import { History } from './history'
import { addFavorite, deleteFolder, moveItem, newFolder, pinTab, unpinTab } from './organize'
import { THEME_PRESETS } from '../shared/themes'
import { Store, newId, newSpace } from './store'

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
  readonly history = new History()
  readonly archive = new Archive()
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

  /** Each Space with its own profile gets a separate cookie jar; everything else shares one. */
  partitionFor(tabId: string): string {
    const profileId = locate(this.state, tabId)?.space?.profileId
    return profileId ? `persist:profile-${profileId}` : 'persist:default'
  }

  private sessionFor(tabId: string): Session {
    const ses = session.fromPartition(this.partitionFor(tabId))
    if (!this.configuredSessions.has(ses)) {
      this.configuredSessions.add(ses)
      this.configureSession(ses)
    }
    return ses
  }

  /** One-time setup for each browsing session (cookie jar). */
  private configureSession(ses: Session): void {
    cleanUserAgent(ses)
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
    wc.on('page-title-updated', (_e, title) => {
      this.updateTab(tabId, { title })
      this.history.update(wc.getURL(), { title })
    })
    wc.on('page-favicon-updated', (_e, icons) => {
      if (!icons[0]) return
      this.updateTab(tabId, { favicon: icons[0] })
      this.history.update(wc.getURL(), { favicon: icons[0] })
    })
    wc.on('did-navigate', (_e, url) => {
      const tab = this.tab(tabId)
      // A new site means the old icon no longer applies.
      const favicon = tab && originOf(tab.url) === originOf(url) ? tab.favicon : undefined
      this.updateTab(tabId, { url, favicon })
      this.history.visit(url, wc.getTitle(), favicon)
      runtime()
    })
    wc.on('did-navigate-in-page', (_e, url, isMainFrame) => {
      if (isMainFrame) {
        this.updateTab(tabId, { url })
        this.history.visit(url, wc.getTitle(), this.tab(tabId)?.favicon)
      }
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

  /** JPEG snapshots of the given tabs' pages, as data: URLs. */
  async capture(tabIds: string[]): Promise<Record<string, string>> {
    const out: Record<string, string> = {}
    await Promise.all(
      tabIds.map(async (id) => {
        const view = this.views.get(id)
        if (!view || !this.attached.includes(id)) return
        try {
          const img = await view.webContents.capturePage()
          if (!img.isEmpty()) out[id] = `data:image/jpeg;base64,${img.toJPEG(82).toString('base64')}`
        } catch {
          // A page that can't be captured just shows a blank card.
        }
      })
    )
    return out
  }

  /** Search suggestions from the chosen search engine. */
  async suggest(query: string): Promise<string[]> {
    if (!query.trim()) return []
    const url = SEARCH_ENGINES[this.state.settings.searchEngine].suggest.replace('%s', encodeURIComponent(query))
    try {
      const res = await net.fetch(url, { signal: AbortSignal.timeout(1500) })
      const data = (await res.json()) as unknown
      // The common "OpenSearch" format: [query, [suggestion, suggestion, ...]]
      if (Array.isArray(data) && Array.isArray(data[1])) return (data[1] as unknown[]).map(String).slice(0, 5)
    } catch {
      // Offline or blocked: just no suggestions.
    }
    return []
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

  /** Mark the tab(s) currently shown in a Space as "just viewed" (used when leaving them). */
  private touchActive(space: Space): void {
    const loc = space.activeId ? locate(this.state, space.activeId) : null
    if (!loc) return
    const now = Date.now()
    if (loc.item.kind === 'tab') loc.item.lastViewedAt = now
    if (loc.item.kind === 'split') for (const t of loc.item.tabs) t.lastViewedAt = now
  }

  activate(id: string): void {
    const loc = locate(this.state, id)
    if (!loc) return
    const space = loc.space ?? activeSpace(this.state)
    this.touchActive(space)
    // Clicking a tab inside a split shows the whole split.
    space.activeId = loc.split ? loc.split.id : id
    if (loc.item.kind === 'tab') {
      loc.item.lastViewedAt = Date.now()
      if (loc.item.url) this.focusOnAttach = id
    }
    this.store.changed()
  }

  /** The tab to show after the current one goes away: the most recently viewed open tab. */
  private pickNext(space: Space, excludeId: string): string | null {
    const candidates = [...this.state.favorites, ...tabsIn(space.pinned), ...tabsIn(space.today)]
      .filter((t) => t.id !== excludeId && this.views.has(t.id))
      .sort((a, b) => b.lastViewedAt - a.lastViewedAt)
    return candidates[0]?.id ?? space.today.find((i) => i.kind !== 'folder')?.id ?? null
  }

  closeTab(id: string): void {
    const loc = locate(this.state, id)
    if (!loc || loc.item.kind !== 'tab') return
    const tab = loc.item
    const space = loc.space ?? activeSpace(this.state)
    const wasActive = space.activeId === id
    this.destroyView(id)
    if (loc.zone !== 'today') {
      // Pinned tabs and favorites never disappear when closed: they just go to sleep.
      if (tab.pinnedUrl) tab.url = tab.pinnedUrl
      if (wasActive) this.showNext(space, id)
    } else {
      loc.list.splice(loc.index, 1)
      this.archive.add(tab, space.id, true)
      if (wasActive) {
        // Prefer the neighbour below, like closing a tab in a list.
        const next = loc.list[loc.index] ?? loc.list[loc.index - 1]
        if (next) this.activate(next.id)
        else this.showNext(space, id)
      }
    }
    this.store.changed()
  }

  private showNext(space: Space, excludeId: string): void {
    const next = this.pickNext(space, excludeId)
    space.activeId = null
    if (next) this.activate(next)
  }

  /** Remove a pinned tab, favorite or folder for good. */
  deleteItem(id: string): void {
    const loc = locate(this.state, id)
    if (!loc) return
    if (loc.item.kind === 'folder') {
      deleteFolder(this.state, id)
    } else if (loc.item.kind === 'tab') {
      const space = loc.space ?? activeSpace(this.state)
      loc.list.splice(loc.index, 1)
      this.destroyView(id)
      if (space.activeId === id) this.showNext(space, id)
    }
    this.store.changed()
  }

  // ---------- Archive ----------

  /** Tidy away Today tabs nobody has looked at for a while (the time is set in Settings). */
  autoArchive(): void {
    const limit = ARCHIVE_AFTER_MS[this.state.settings.archiveAfter]
    if (!limit) return
    const cutoff = Date.now() - limit
    let changed = false
    for (const space of this.state.spaces) {
      space.today = space.today.filter((item) => {
        if (item.kind === 'folder' || item.id === space.activeId) return true
        const tabs = item.kind === 'tab' ? [item] : item.tabs
        if (tabs.some((t) => t.lastViewedAt > cutoff || this.attached.includes(t.id))) return true
        for (const tab of tabs) {
          this.destroyView(tab.id)
          this.archive.add(tab, space.id, false)
        }
        changed = true
        return false
      })
    }
    if (changed) this.store.changed()
  }

  /** Open an archived tab again (in its old Space if it still exists). */
  private reopen(entry: ArchivedTab, preferOriginalSpace: boolean): void {
    if (preferOriginalSpace && this.state.spaces.some((s) => s.id === entry.spaceId)) this.switchSpace(entry.spaceId)
    const tab = this.newTab(entry.url, true)
    tab.title = entry.title
    tab.favicon = entry.favicon
    this.store.changed()
  }

  reopenClosed(): void {
    const entry = this.archive.popRecentlyClosed()
    if (entry) this.reopen(entry, true)
  }

  restoreArchived(id: string): void {
    const entry = this.archive.get(id)
    if (!entry) return
    this.archive.remove(id)
    this.reopen(entry, false)
  }

  // ---------- Spaces ----------

  switchSpace(id: string): void {
    const space = this.state.spaces.find((s) => s.id === id)
    if (!space || this.state.activeSpaceId === id) return
    const leaving = this.state.spaces.find((s) => s.id === this.state.activeSpaceId)
    if (leaving) this.touchActive(leaving)
    this.state.activeSpaceId = id
    if (space.activeId) this.activate(space.activeId)
    this.store.changed()
  }

  createSpace(name?: string, icon?: string): string {
    const n = this.state.spaces.length + 1
    const preset = THEME_PRESETS[n % THEME_PRESETS.length]
    const space = newSpace(name ?? `Space ${n}`, icon ?? '⭐️', [...preset.colors])
    this.state.spaces.push(space)
    this.switchSpace(space.id)
    this.store.changed()
    return space.id
  }

  deleteSpace(id: string): void {
    if (this.state.spaces.length <= 1) return
    const index = this.state.spaces.findIndex((s) => s.id === id)
    if (index < 0) return
    const space = this.state.spaces[index]
    for (const tab of [...tabsIn(space.pinned), ...tabsIn(space.today)]) this.destroyView(tab.id)
    this.state.spaces.splice(index, 1)
    if (space.profileId) this.forgetProfile(space.profileId)
    if (this.state.activeSpaceId === id) {
      this.state.activeSpaceId = ''
      this.switchSpace(this.state.spaces[Math.max(0, index - 1)].id)
    }
    this.store.changed()
  }

  /** Turn a Space's separate profile on/off. Its tabs reload in the new cookie jar. */
  setSeparateProfile(id: string, separate: boolean): void {
    const space = this.state.spaces.find((s) => s.id === id)
    if (!space || separate === !!space.profileId) return
    for (const tab of [...tabsIn(space.pinned), ...tabsIn(space.today)]) this.destroyView(tab.id)
    if (space.profileId) this.forgetProfile(space.profileId)
    space.profileId = separate ? newId() : null
    if (space.activeId) this.activate(space.activeId)
    this.store.changed()
  }

  private forgetProfile(profileId: string): void {
    session
      .fromPartition(`persist:profile-${profileId}`)
      .clearStorageData()
      .catch(() => {})
  }

  moveToSpace(tabId: string, spaceId: string): void {
    const loc = locate(this.state, tabId)
    const target = this.state.spaces.find((s) => s.id === spaceId)
    if (!loc || !target || loc.space === target) return
    const oldPartition = this.partitionFor(tabId)
    const wasActive = loc.space?.activeId === tabId
    if (!moveItem(this.state, tabId, { zone: 'today', spaceId, parentId: null, index: 0 })) return
    // A different profile means a different cookie jar: reload the tab there.
    if (this.partitionFor(tabId) !== oldPartition) this.destroyView(tabId)
    if (wasActive && loc.space) this.showNext(loc.space, tabId)
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
      case 'tab/copyUrl': {
        const tab = this.tab(action.id)
        if (tab?.url) {
          clipboard.writeText(tab.url)
          this.command({ type: 'toast', message: 'Copied URL' })
        }
        return
      }
      case 'tab/resetPinned': {
        const tab = this.tab(action.id)
        if (tab?.pinnedUrl) this.navigate(tab.id, tab.pinnedUrl)
        return
      }
      case 'tab/pin':
        pinTab(this.state, action.id, activeSpace(this.state))
        return this.store.changed()
      case 'tab/unpin':
        unpinTab(this.state, action.id, activeSpace(this.state))
        return this.store.changed()
      case 'tab/favorite':
        addFavorite(this.state, action.id, activeSpace(this.state))
        return this.store.changed()
      case 'item/move': {
        const before = this.partitionFor(action.id)
        moveItem(this.state, action.id, action.to)
        // Moved into a Space with a different profile: reload it in that cookie jar.
        if (this.partitionFor(action.id) !== before) this.destroyView(action.id)
        return this.store.changed()
      }
      case 'item/delete':
        return this.deleteItem(action.id)
      case 'folder/new': {
        const folder = newFolder(activeSpace(this.state), action.name)
        this.store.changed()
        return folder.id
      }
      case 'folder/rename':
      case 'folder/toggle': {
        const loc = locate(this.state, action.id)
        if (loc?.item.kind !== 'folder') return
        if (action.type === 'folder/rename') loc.item.name = action.name.trim() || loc.item.name
        else loc.item.collapsed = !loc.item.collapsed
        return this.store.changed()
      }
      case 'today/clear': {
        const space = activeSpace(this.state)
        for (const tab of tabsIn(space.today)) {
          this.destroyView(tab.id)
          this.archive.add(tab, space.id, false)
        }
        const activeWasToday = space.today.some((i) => i.id === space.activeId)
        space.today = []
        if (activeWasToday) this.showNext(space, '')
        return this.store.changed()
      }
      case 'space/new':
        return this.createSpace(action.name, action.icon)
      case 'space/switch':
        return this.switchSpace(action.id)
      case 'space/switchIndex': {
        const space = this.state.spaces[action.index]
        if (space) this.switchSpace(space.id)
        return
      }
      case 'space/switchRelative': {
        const i = this.state.spaces.findIndex((s) => s.id === this.state.activeSpaceId)
        const next = this.state.spaces[i + action.delta]
        if (next) this.switchSpace(next.id)
        return
      }
      case 'space/update': {
        const space = this.state.spaces.find((s) => s.id === action.id)
        if (!space) return
        if (action.patch.name !== undefined) space.name = action.patch.name.trim() || space.name
        if (action.patch.icon !== undefined) space.icon = action.patch.icon || space.icon
        if (action.patch.theme) space.theme = { ...space.theme, ...action.patch.theme }
        return this.store.changed()
      }
      case 'space/setProfile':
        return this.setSeparateProfile(action.id, action.separate)
      case 'space/delete':
        return this.deleteSpace(action.id)
      case 'space/reorder': {
        const from = this.state.spaces.findIndex((s) => s.id === action.id)
        if (from < 0) return
        const [space] = this.state.spaces.splice(from, 1)
        this.state.spaces.splice(Math.max(0, Math.min(action.index, this.state.spaces.length)), 0, space)
        return this.store.changed()
      }
      case 'tab/moveToSpace':
        return this.moveToSpace(action.id, action.spaceId)
      case 'tab/reopenClosed':
        return this.reopenClosed()
      case 'archive/restore':
        return this.restoreArchived(action.id)
      case 'archive/remove':
        return this.archive.remove(action.id)
      case 'archive/clear':
        return this.archive.clear()
      case 'settings/update':
        Object.assign(this.state.settings, action.patch)
        if (action.patch.archiveAfter) this.autoArchive()
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
