// The heart of VAIA: owns the main window, the web page views, and every
// action the UI can ask for (open tab, close tab, navigate, ...).
import {
  BrowserWindow,
  Menu,
  MenuItem,
  app,
  nativeImage,
  net,
  shell,
  WebContentsView,
  clipboard,
  dialog,
  session,
  type ContextMenuParams,
  type Session
} from 'electron'
import { basename, extname, join } from 'node:path'
import type { Action } from '../shared/api'
import { activeSpace, allTabs, locate, tabsIn } from '../shared/tree'
import type {
  ArchivedTab,
  Boost,
  DownloadItem,
  FolderItem,
  Pane,
  Rect,
  SidebarItem,
  Space,
  SplitPreset,
  TabItem,
  Todo,
  UiCommand
} from '../shared/types'
import { SEARCH_ENGINES, displayHost, inputToUrl, sameUrl, siteKey } from '../shared/url'
import { errorPageScript } from './errorPage'
import { existsSync } from 'node:fs'
import { AdBlock } from './adblock'
import { AiTidyError, aiTidyPlan, clearApiKey, hasApiKey, saveApiKey } from './ai'
import { ImportError, countLinks, readChrome, readHtmlFile, readSafari, type BookmarkNode, type BookmarkTree } from './bookmarks'
import { EXTENSIONS_PARTITION, Extensions } from './extensions'
import { Permissions } from './permissions'
import { ARCHIVE_AFTER_MS, Archive } from './archive'
import { EMPTY_BOOST, ZAP_SCRIPT, boostCss } from './boosts'
import { History } from './history'
import {
  addFavorite,
  addToSplit,
  applySplitPreset,
  deleteFolder,
  detachFromSplit,
  dissolveSplit,
  evenSplit,
  moveItem,
  newFolder,
  pinTab,
  removeFromSplit,
  unpinTab
} from './organize'
import { THEME_PRESETS } from '../shared/themes'
import { Store, newId, newSpace, readJson, writeJson } from './store'
import { applyAiPlan, pruneEmptyFolders, simpleTidy, tidyInput, type TidyResult } from './tidy'

/** Checked-off to-dos are deleted this long after being checked. */
const DONE_TODO_KEEP_MS = 7 * 24 * 60 * 60 * 1000
const UNDO_MS = 6000

interface ToastOptions {
  /** A button in the toast, e.g. Undo. */
  action?: { label: string; run: () => void }
  duration?: number
}
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
  readonly adblock = new AdBlock()
  private settingsWin: BrowserWindow | null = null
  private downloadItems = new Map<string, Electron.DownloadItem>()
  private toastView: WebContentsView | null = null
  private toastTimer: NodeJS.Timeout | null = null
  private toastAction: (() => void) | null = null
  /** The Today list from before the last Tidy, for Undo. */
  private tidyUndo: { spaceId: string; today: SidebarItem[] } | null = null
  private tidying = false
  private todoWin: BrowserWindow | null = null
  readonly permissions = new Permissions(
    () => {
      this.store.sitePermissions = { ...this.permissions.saved }
      this.store.changed(false)
    },
    (message) => this.showToast(message)
  )
  readonly extensions = new Extensions({
    createTab: async (url, active) => {
      if (!this.win) this.createWindow()
      const tab = this.newTab(url, active)
      return [this.ensureView(tab).webContents, this.win!]
    },
    selectTab: (wc) => {
      const id = this.tabIdOf(wc)
      if (!id) return
      const space = locate(this.state, id)?.space
      if (space && space.id !== this.state.activeSpaceId) this.switchSpace(space.id)
      this.activate(id)
    },
    removeTab: (wc) => {
      const id = this.tabIdOf(wc)
      if (id) this.closeTab(id)
    },
    createWindow: async (url) => this.openLittle(url),
    disabled: () => this.state.settings.disabledExtensions,
    onChange: (list) => {
      this.store.extensions = list
      this.store.changed(false)
    }
  })
  /** Pages whose process crashed: they show a "page crashed" card until reloaded. */
  private crashed = new Set<string>()
  /** A page playing full screen (e.g. a video), per window. */
  private fullscreen = new Map<BrowserWindow, { tabId: string; madeFullScreen: boolean }>()
  /** The panes each window's UI asked for last (to lay out again after full screen or a crash). */
  private lastPanes = new Map<BrowserWindow, Pane[]>()
  private extensionTabs = new WeakSet<Electron.WebContents>()
  private selectedExtensionTab: Electron.WebContents | null = null
  /** The Boost style sheet currently added to each tab's page (so it can be swapped). */
  private boostCssKeys = new Map<string, string>()
  private boostQueue = new Map<string, Promise<void>>()
  private zapping = new Set<string>()
  private views = new Map<string, WebContentsView>()
  /** Which tab views are currently shown in each window. */
  private attached = new Map<BrowserWindow, string[]>()
  /** The main window's panes as last reported by its UI (Peek is added on top). */
  private mainPanes: Pane[] = []
  private peekRect: Rect | null = null
  /** Little windows, by the id of the tab they show. */
  private littles = new Map<string, { tab: TabItem; win: BrowserWindow }>()
  private focusOnAttach: string | null = null
  private configuredSessions = new Set<Session>()
  private layoutWatched = new WeakSet<BrowserWindow>()

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
    // The UI is laid out in exact pixels to line up with web pages; don't let it zoom or navigate.
    this.hardenUiWindow(win)
    win.once('ready-to-show', () => win.show())
    win.on('closed', () => {
      // Close every page except those living in Little windows.
      for (const id of [...this.views.keys()]) if (!this.littles.has(id)) this.destroyView(id)
      this.attached.delete(win)
      this.closePeek()
      this.win = null
    })
    loadUi(win)
    return win
  }

  private hardenUiWindow(win: BrowserWindow): void {
    win.webContents.on('did-finish-load', () => win.webContents.setVisualZoomLevelLimits(1, 1).catch(() => {}))
    win.webContents.on('before-input-event', (event, input) => {
      if (input.meta && ['=', '+', '-', '0'].includes(input.key)) event.preventDefault()
    })
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    win.webContents.on('will-navigate', (e) => e.preventDefault())
  }

  /** Send a command to the main window's UI, focusing it first. */
  command(cmd: UiCommand): void {
    if (!this.win) return
    this.win.webContents.focus()
    this.win.webContents.send('ui:command', cmd)
  }

  /** Tell the main window's UI something without moving keyboard focus. */
  notify(cmd: UiCommand): void {
    this.win?.webContents.send('ui:command', cmd)
  }

  /**
   * A small message at the bottom of the window. It lives in its own tiny
   * see-through view so it shows on top of web pages, too.
   */
  showToast(message: string, opts: ToastOptions = {}): void {
    const target = BrowserWindow.getFocusedWindow() ?? this.win
    if (!target) return
    if (!this.toastView) {
      this.toastView = new WebContentsView({
        webPreferences: { sandbox: true, contextIsolation: true, javascript: false }
      })
      this.toastView.setBackgroundColor('#00000000')
      // The toast has no scripts; its button is a link we catch here instead of following.
      this.toastView.webContents.on('will-navigate', (e, url) => {
        e.preventDefault()
        if (url !== 'vaia-toast://action') return
        const run = this.toastAction
        this.hideToast()
        run?.()
      })
    }
    const view = this.toastView
    const duration = opts.duration ?? (opts.action ? UNDO_MS : 1800)
    this.toastAction = opts.action?.run ?? null
    const safe = (text: string) => text.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)
    const button = opts.action ? `<a href="vaia-toast://action">${safe(opts.action.label)}</a>` : ''
    const html = `<!doctype html><html><head><style>
      html,body{margin:0;height:100%;background:transparent;overflow:hidden}
      body{display:flex;align-items:center;justify-content:center;font:500 12.5px -apple-system,system-ui,sans-serif}
      div{display:flex;align-items:center;gap:12px;padding:8px 16px;border-radius:999px;background:rgba(30,30,32,.9);color:#fff;white-space:nowrap;
        box-shadow:0 6px 20px rgba(0,0,0,.22);animation:t ${duration}ms cubic-bezier(.2,.8,.2,1) both}
      a{color:#9fd8b8;font-weight:600;text-decoration:none;padding:2px 8px;margin:-2px -8px -2px 0;border-radius:999px;cursor:pointer}
      a:hover{background:rgba(255,255,255,.12)}
      @keyframes t{0%{opacity:0;transform:translateY(8px)}6%,92%{opacity:1;transform:none}100%{opacity:0}}
    </style></head><body><div><span>${safe(message)}</span>${button}</div></body></html>`
    view.webContents.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`).catch(() => {})
    const [w, h] = target.getContentSize()
    // Keep the toast's (see-through) box close to its text so it doesn't block clicks on the page.
    const guess = message.length * 7 + (opts.action ? opts.action.label.length * 8 + 70 : 50)
    const width = Math.min(460, w - 40, Math.max(160, guess))
    view.setBounds({ x: Math.round((w - width) / 2), y: h - 72, width, height: 56 })
    // Adding it again moves it on top of everything else in the window.
    target.contentView.addChildView(view)
    if (this.toastTimer) clearTimeout(this.toastTimer)
    this.toastTimer = setTimeout(() => this.hideToast(), duration + 100)
  }

  private hideToast(): void {
    if (this.toastTimer) clearTimeout(this.toastTimer)
    this.toastTimer = null
    this.toastAction = null
    const view = this.toastView
    if (!view) return
    for (const win of BrowserWindow.getAllWindows()) if (win.contentView.children.includes(view)) win.contentView.removeChildView(view)
  }

  // ---------- Settings window ----------

  openSettings(): void {
    if (this.settingsWin && !this.settingsWin.isDestroyed()) {
      this.settingsWin.focus()
      return
    }
    const win = new BrowserWindow({
      width: 680,
      height: 640,
      minWidth: 560,
      minHeight: 420,
      title: 'VAIA Settings',
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 16, y: 16 },
      vibrancy: 'sidebar',
      visualEffectState: 'active',
      backgroundColor: '#00000000',
      show: false,
      webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false, sandbox: true }
    })
    this.settingsWin = win
    this.store.subscribe(win.webContents)
    this.hardenUiWindow(win)
    win.once('ready-to-show', () => win.show())
    win.on('closed', () => (this.settingsWin = null))
    loadUi(win, 'settings')
  }

  /** Erase the chosen kinds of browsing data in every profile. */
  async clearData(what: { history?: boolean; cookies?: boolean; cache?: boolean; archive?: boolean }): Promise<void> {
    if (what.history) this.history.clear()
    if (what.archive) this.archive.clear()
    const partitions = new Set(['persist:default'])
    for (const s of this.state.spaces) if (s.profileId) partitions.add(`persist:profile-${s.profileId}`)
    for (const p of partitions) {
      const ses = session.fromPartition(p)
      if (what.cookies) await ses.clearStorageData()
      if (what.cache) await ses.clearCache()
    }
    this.showToast('Browsing data cleared')
  }

  // ---------- Downloads ----------

  private loadDownloads(): void {
    // Only finished downloads are remembered between launches.
    this.store.downloads = readJson<DownloadItem[]>('downloads.json', []).filter((d) => d.state !== 'progressing')
  }

  private saveDownloads(): void {
    try {
      writeJson('downloads.json', this.store.downloads.filter((d) => d.state !== 'progressing'))
    } catch (err) {
      console.error('[downloads] save failed', err)
    }
  }

  private trackDownload(item: Electron.DownloadItem): void {
    const path = uniquePath(app.getPath('downloads'), item.getFilename())
    item.setSavePath(path)
    const entry: DownloadItem = {
      id: newId(),
      filename: basename(path),
      path,
      url: item.getURL(),
      state: 'progressing',
      received: 0,
      total: item.getTotalBytes(),
      startedAt: Date.now()
    }
    this.store.downloads.unshift(entry)
    this.store.downloads.length = Math.min(this.store.downloads.length, 200)
    this.downloadItems.set(entry.id, item)
    this.store.changed(false)
    this.showToast(`Downloading ${entry.filename}`)
    item.on('updated', (_e, st) => {
      entry.received = item.getReceivedBytes()
      entry.total = item.getTotalBytes()
      entry.state = st === 'interrupted' ? 'interrupted' : 'progressing'
      this.store.changed(false)
    })
    item.once('done', (_e, st) => {
      entry.received = item.getReceivedBytes()
      entry.state = st === 'completed' ? 'completed' : st === 'cancelled' ? 'cancelled' : 'interrupted'
      this.downloadItems.delete(entry.id)
      if (st === 'completed') {
        app.dock?.downloadFinished(path)
        this.showToast(`Downloaded ${entry.filename}`)
      }
      this.store.changed(false)
      this.saveDownloads()
    })
  }

  /** A thumbnail of a downloaded file (macOS Quick Look), or its Finder icon. Cached per file. */
  private thumbnails = new Map<string, string | null>()
  async downloadThumbnail(id: string): Promise<string | null> {
    const entry = this.store.downloads.find((d) => d.id === id)
    if (!entry || entry.state !== 'completed' || !existsSync(entry.path)) return null
    if (this.thumbnails.has(id)) return this.thumbnails.get(id)!
    let url: string | null = null
    try {
      const thumb = await nativeImage.createThumbnailFromPath(entry.path, { width: 96, height: 96 })
      if (!thumb.isEmpty()) url = thumb.toDataURL()
    } catch {
      try {
        url = (await app.getFileIcon(entry.path, { size: 'normal' })).toDataURL()
      } catch {
        url = null
      }
    }
    this.thumbnails.set(id, url)
    return url
  }

  private downloadAction(id: string, what: 'open' | 'show' | 'cancel'): void {
    const entry = this.store.downloads.find((d) => d.id === id)
    if (!entry) return
    if (what === 'cancel') this.downloadItems.get(id)?.cancel()
    else if (!existsSync(entry.path)) this.showToast('That file was moved or deleted')
    else if (what === 'open') shell.openPath(entry.path)
    else shell.showItemInFolder(entry.path)
  }

  // ---------- Web page views ----------

  /** Each Space with its own profile gets a separate cookie jar; everything else shares one. */
  partitionFor(tabId: string): string {
    // Private windows get a temporary cookie jar (no "persist:"), thrown away on close.
    if (this.littles.get(tabId)?.tab.private) return `private-${tabId}`
    const profileId = locate(this.state, tabId)?.space?.profileId
    return profileId ? `persist:profile-${profileId}` : EXTENSIONS_PARTITION
  }

  private sessionFor(tabId: string): Session {
    return this.configuredSession(this.partitionFor(tabId))
  }

  private configuredSession(partition: string): Session {
    const ses = session.fromPartition(partition)
    if (!this.configuredSessions.has(ses)) {
      this.configuredSessions.add(ses)
      this.configureSession(ses, !partition.startsWith('persist:'))
    }
    return ses
  }

  /** One-time setup for each browsing session (cookie jar). */
  private configureSession(ses: Session, isPrivate: boolean): void {
    cleanUserAgent(ses)
    ses.on('will-download', (_e, item, wc) => {
      this.trackDownload(item)
      // A brand-new tab whose only "page" was a download closes again (like Chrome).
      const id = wc && !wc.isDestroyed() ? this.tabIdOf(wc) : null
      if (id && !wc.getURL() && wc.navigationHistory.length() <= 1) setImmediate(() => this.closeTab(id))
    })
    this.adblock.addSession(ses)
    this.permissions.attach(ses, isPrivate)
  }

  /** Start-up work that needs the saved settings. */
  init(): void {
    this.loadDownloads()
    this.store.aiKeySet = hasApiKey()
    this.store.sitePermissions = { ...this.permissions.saved }
    this.purgeDoneTodos()
    if (this.state.settings.adBlock) this.adblock.setEnabled(true)
    this.extensions.init(this.configuredSession(EXTENSIONS_PARTITION)).catch((err) => console.error('[extensions]', err))
  }

  private tabIdOf(wc: Electron.WebContents): string | null {
    for (const [id, view] of this.views) if (view.webContents === wc) return id
    return null
  }

  private ensureView(tab: TabItem): WebContentsView {
    let view = this.views.get(tab.id)
    if (view) return view
    view = new WebContentsView({
      webPreferences: {
        session: this.sessionFor(tab.id),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        // Turns on Chromium's built-in PDF viewer, so PDFs open instead of downloading.
        plugins: true,
        spellcheck: true
      }
    })
    view.setBorderRadius(10)
    view.setBackgroundColor('#ffffff')
    this.views.set(tab.id, view)
    this.wireView(tab.id, view)
    if (this.partitionFor(tab.id) === EXTENSIONS_PARTITION && this.win) {
      // Extensions can see (and act on) tabs in your normal profile.
      this.extensions.addTab(view.webContents, this.win)
      this.extensionTabs.add(view.webContents)
    }
    if (tab.url) view.webContents.loadURL(tab.url).catch(() => {})
    return view
  }

  isAttached(tabId: string): boolean {
    for (const ids of this.attached.values()) if (ids.includes(tabId)) return true
    return false
  }

  /** Is this a pinned tab or favorite? Links from those to other sites open in Peek. */
  private opensLinksInPeek(tabId: string): boolean {
    const zone = locate(this.state, tabId)?.zone
    return this.state.settings.peekPinnedLinks && (zone === 'pinned' || zone === 'favorites')
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
    // Private windows never touch your history.
    const history = this.littles.get(tabId)?.tab.private ? null : this.history
    wc.on('page-title-updated', (_e, title) => {
      this.updateTab(tabId, { title })
      history?.update(wc.getURL(), { title })
    })
    wc.on('page-favicon-updated', (_e, icons) => {
      if (!icons[0]) return
      this.updateTab(tabId, { favicon: icons[0] })
      history?.update(wc.getURL(), { favicon: icons[0] })
    })
    wc.on('did-navigate', (_e, url) => {
      const tab = this.tab(tabId)
      // A new site means the old icon no longer applies.
      const sameSite = !!tab && originOf(tab.url) === originOf(url)
      const favicon = sameSite ? tab.favicon : undefined
      // A short name from AI Tidy described the old page.
      this.updateTab(tabId, sameSite ? { url, favicon } : { url, favicon, name: undefined })
      history?.visit(url, wc.getTitle(), favicon)
      runtime()
    })
    wc.on('did-navigate-in-page', (_e, url, isMainFrame) => {
      if (isMainFrame) {
        this.updateTab(tabId, { url })
        history?.visit(url, wc.getTitle(), this.tab(tabId)?.favicon)
      }
      runtime()
    })
    wc.on('did-start-loading', runtime)
    wc.on('did-stop-loading', runtime)
    wc.setWindowOpenHandler(({ url, disposition }) => {
      // Real popups (e.g. "Sign in with Google") need to stay popups.
      if (disposition === 'new-window') return { action: 'allow' }
      if (this.littles.get(tabId)?.tab.private) {
        // Links from a private window stay private: open them right there.
        wc.loadURL(url).catch(() => {})
        return { action: 'deny' }
      }
      if (disposition === 'foreground-tab' && this.opensLinksInPeek(tabId) && !isAuthUrl(url)) this.openPeek(url)
      else this.newTab(url, disposition !== 'background-tab', tabId)
      return { action: 'deny' }
    })
    // Clicking a link to another site from a pinned tab opens it in Peek instead.
    // "settled" = the page finished loading, so this is you clicking, not a load-time redirect.
    let settled = false
    wc.on('did-navigate', () => (settled = false))
    wc.on('did-stop-loading', () => (settled = true))
    wc.on('will-navigate', (e) => {
      if (!settled || !this.opensLinksInPeek(tabId)) return
      if (siteOf(e.url) === siteOf(wc.getURL()) || isAuthUrl(e.url) || !/^https?:/.test(e.url)) return
      e.preventDefault()
      this.openPeek(e.url)
    })
    wc.on('before-input-event', (e, input) => {
      if (input.type === 'keyDown' && input.key === 'Escape' && this.store.peek?.id === tabId) {
        e.preventDefault()
        this.closePeek()
      }
    })
    wc.on('context-menu', (_e, params) => this.pageMenu(tabId, params))

    // Friendly error pages. Chromium shows a blank page when a site can't load;
    // we fill it in with an explanation and buttons (links to vaia-page:, caught below).
    let failed: { url: string; code: number; description: string } | null = null
    wc.on('did-fail-load', (_e, code, description, url, isMainFrame) => {
      // -3 = cancelled (e.g. the link turned into a download, or you clicked elsewhere).
      if (!isMainFrame || code === -3) return
      failed = { url, code, description }
      this.updateTab(tabId, { url, title: displayHost(url) })
    })
    wc.on('did-start-navigation', (details) => {
      if (details.isMainFrame && !details.isSameDocument && details.url !== failed?.url) failed = null
    })
    wc.on('will-navigate', (e) => {
      if (!e.url.startsWith('vaia-page:')) return
      e.preventDefault()
      const action = e.url.slice('vaia-page:'.length)
      if (action === 'reload' && failed) wc.loadURL(failed.url).catch(() => {})
      else if (action === 'back') wc.navigationHistory.goBack()
      else if (action === 'close') this.closeTab(tabId)
    })
    wc.on('render-process-gone', (_e, details) => {
      if (details.reason === 'clean-exit') return
      // The page crashed: drop it and show a "page crashed" card with a Reload button.
      setImmediate(() => {
        if (!this.views.has(tabId)) return
        this.destroyView(tabId)
        this.crashed.add(tabId)
        this.store.runtime[tabId] = { loading: false, canGoBack: false, canGoForward: false, crashed: true }
        this.store.changed(false)
      })
    })

    // Full screen video: the page fills the whole screen (the window goes full screen too).
    wc.on('enter-html-full-screen', () => {
      const win = this.windowShowing(tabId)
      if (!win) return
      const madeFullScreen = !win.isFullScreen()
      this.fullscreen.set(win, { tabId, madeFullScreen })
      if (madeFullScreen) win.setFullScreen(true)
      this.relayout(win)
    })
    wc.on('leave-html-full-screen', () => {
      for (const [win, fs] of this.fullscreen) {
        if (fs.tabId !== tabId) continue
        this.fullscreen.delete(win)
        if (fs.madeFullScreen && !win.isDestroyed()) win.setFullScreen(false)
        this.relayout(win)
      }
    })

    // Boosts: re-apply the site's customizations every time a page loads.
    wc.on('did-navigate', () => this.boostCssKeys.delete(tabId))
    wc.on('dom-ready', () => {
      if (failed && wc.getURL() === failed.url) {
        const canGoBack = wc.navigationHistory.canGoBack()
        wc.executeJavaScript(errorPageScript(failed.url, failed.code, failed.description, canGoBack)).catch(() => {})
        return
      }
      this.applyBoostCss(tabId)
      const boost = this.boostFor(wc.getURL())
      if (boost?.enabled && boost.js.trim()) wc.executeJavaScript(boost.js).catch(() => {})
    })
    wc.on('found-in-page', (_e, result) => {
      if (result.finalUpdate) {
        this.notify({ type: 'find-result', matches: result.matches, active: result.activeMatchOrdinal })
      }
    })
    // In a split, the pane you click becomes the one the address bar shows.
    wc.on('focus', () => {
      const split = locate(this.state, tabId)?.split
      if (split && split.focusedId !== tabId) {
        split.focusedId = tabId
        this.store.changed()
      }
    })
  }

  private destroyView(tabId: string): void {
    const view = this.views.get(tabId)
    if (!view) return
    for (const [win, ids] of this.attached) {
      if (!ids.includes(tabId)) continue
      if (!win.isDestroyed()) win.contentView.removeChildView(view)
      this.attached.set(win, ids.filter((id) => id !== tabId))
    }
    for (const [win, fs] of this.fullscreen) if (fs.tabId === tabId) this.fullscreen.delete(win)
    if (this.selectedExtensionTab === view.webContents) this.selectedExtensionTab = null
    view.webContents.close()
    this.views.delete(tabId)
    this.boostCssKeys.delete(tabId)
    this.boostQueue.delete(tabId)
    delete this.store.runtime[tabId]
  }

  /** A window's UI tells us exactly which pages should be visible in it, and where. */
  setPanes(win: BrowserWindow, panes: Pane[]): void {
    if (win === this.win) {
      this.mainPanes = panes
      this.layoutMain()
    } else {
      this.applyLayout(win, panes)
    }
  }

  /** Where the Peek card's page goes (null = no Peek). */
  setPeekRect(rect: Rect | null): void {
    this.peekRect = rect
    this.layoutMain()
  }

  private layoutMain(): void {
    if (!this.win) return
    const peek = this.store.peek
    const panes = peek && this.peekRect ? [...this.mainPanes, { tabId: peek.id, rect: this.peekRect }] : this.mainPanes
    this.applyLayout(this.win, panes)
  }

  /** The window a tab's page is showing in right now. */
  private windowShowing(tabId: string): BrowserWindow | null {
    for (const [win, ids] of this.attached) if (ids.includes(tabId) && !win.isDestroyed()) return win
    return null
  }

  /** Lay a window out again with the panes its UI last asked for. */
  private relayout(win: BrowserWindow): void {
    if (win === this.win) this.layoutMain()
    else this.applyLayout(win, this.lastPanes.get(win) ?? [])
  }

  private applyLayout(win: BrowserWindow, requested: Pane[]): void {
    if (win.isDestroyed()) return
    this.lastPanes.set(win, requested)
    if (!this.layoutWatched.has(win)) {
      // While a page is full screen, keep it filling the window as it grows.
      this.layoutWatched.add(win)
      win.on('resize', () => this.fullscreen.has(win) && this.relayout(win))
      win.on('leave-full-screen', () => {
        const fs = this.fullscreen.get(win)
        if (fs) this.views.get(fs.tabId)?.webContents.executeJavaScript('document.exitFullscreen?.()', true).catch(() => {})
      })
    }
    const fs = this.fullscreen.get(win)
    const [w, h] = win.getContentSize()
    const panes = (fs ? [{ tabId: fs.tabId, rect: { x: 0, y: 0, width: w, height: h } }] : requested).filter(
      (p) => !this.crashed.has(p.tabId)
    )
    const before = this.attached.get(win) ?? []
    const wanted = panes.map((p) => p.tabId)
    for (const id of before) {
      const view = this.views.get(id)
      if (view && !wanted.includes(id)) win.contentView.removeChildView(view)
    }
    for (const pane of panes) {
      const tab = this.tab(pane.tabId)
      if (!tab) continue
      const view = this.ensureView(tab)
      view.setBorderRadius(fs ? 0 : 10)
      const r = pane.rect
      view.setBounds({
        x: Math.round(r.x),
        y: Math.round(r.y),
        width: Math.max(0, Math.round(r.width)),
        height: Math.max(0, Math.round(r.height))
      })
      // A view shown in another window (e.g. moved out of a Little window) moves here.
      for (const [other, ids] of this.attached) {
        if (other !== win && ids.includes(pane.tabId)) {
          if (!other.isDestroyed()) other.contentView.removeChildView(view)
          this.attached.set(other, ids.filter((id) => id !== pane.tabId))
        }
      }
      if (!before.includes(pane.tabId)) win.contentView.addChildView(view)
    }
    const now = wanted.filter((id) => this.views.has(id))
    this.attached.set(win, now)
    // Tell extensions which tab you're looking at.
    if (win === this.win) {
      const active = this.activeWebContents()
      if (active && active !== this.selectedExtensionTab && this.extensionTabs.has(active)) {
        this.selectedExtensionTab = active
        this.extensions.selectTab(active)
      }
    }
    if (this.focusOnAttach && now.includes(this.focusOnAttach)) {
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
        if (!view || !this.isAttached(id)) return
        try {
          // A page that never drew anything (e.g. a link that turned into a download) can keep
          // capturePage waiting forever; give up quickly so overlays still open.
          const img = await Promise.race([
            view.webContents.capturePage(),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 700))
          ])
          if (img && !img.isEmpty()) out[id] = `data:image/jpeg;base64,${img.toJPEG(82).toString('base64')}`
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
    // Spelling: suggestions for a misspelled word in a text field.
    if (p.isEditable && p.misspelledWord) {
      if (p.dictionarySuggestions.length) {
        for (const word of p.dictionarySuggestions.slice(0, 5)) {
          items.push({ label: word, click: () => wc.replaceMisspelling(word) })
        }
      } else {
        items.push({ label: 'No Guesses Found', enabled: false })
      }
      items.push(
        { label: 'Add to Dictionary', click: () => wc.session.addWordToSpellCheckerDictionary(p.misspelledWord) },
        { type: 'separator' }
      )
    }
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
    if (p.mediaType === 'video') {
      items.push({ label: 'Picture in Picture', click: () => this.pictureInPicture(wc, p.x, p.y) }, { type: 'separator' })
    }
    if (p.isEditable) items.push({ role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { type: 'separator' })
    else if (p.selectionText) items.push({ role: 'copy' }, { type: 'separator' })
    items.push(
      { label: 'Back', enabled: wc.navigationHistory.canGoBack(), click: () => wc.navigationHistory.goBack() },
      { label: 'Forward', enabled: wc.navigationHistory.canGoForward(), click: () => wc.navigationHistory.goForward() },
      { label: 'Reload', click: () => wc.reload() },
      { type: 'separator' },
      { label: 'Print…', click: () => this.print(tabId) }
    )
    const fromExtensions = this.extensionTabs.has(wc) ? this.extensions.contextMenuItems(wc, p) : []
    const menu = Menu.buildFromTemplate([...items, { type: 'separator' }, { label: 'Inspect Element', click: () => wc.inspectElement(p.x, p.y) }])
    if (fromExtensions.length) {
      menu.insert(menu.items.length - 2, new MenuItem({ type: 'separator' }))
      for (const item of fromExtensions) menu.insert(menu.items.length - 2, item)
    }
    menu.popup()
  }

  /** Pop the video under the mouse out into a floating picture-in-picture window. */
  private pictureInPicture(wc: Electron.WebContents, x: number, y: number): void {
    const script = `(() => {
      const v = [...document.querySelectorAll('video')].find((v) => {
        const r = v.getBoundingClientRect()
        return ${x} >= r.left && ${x} <= r.right && ${y} >= r.top && ${y} <= r.bottom
      }) || document.querySelector('video')
      if (!v) return
      return document.pictureInPictureElement === v ? document.exitPictureInPicture() : v.requestPictureInPicture()
    })()`
    wc.executeJavaScript(script, true).catch(() => this.showToast('This video can’t play in picture in picture'))
  }

  /** Print the page (the Mac print dialog lets you save as PDF too). */
  print(tabId: string): void {
    const wc = this.views.get(tabId)?.webContents
    if (!wc) return
    wc.print({}, (ok, reason) => {
      if (!ok && reason && reason !== 'Print job canceled' && reason !== 'cancelled') console.error('[print]', reason)
    })
  }

  // ---------- Helpers ----------

  tab(id: string): TabItem | null {
    const loc = locate(this.state, id)
    if (loc && loc.item.kind === 'tab') return loc.item
    if (this.store.peek?.id === id) return this.store.peek
    return this.littles.get(id)?.tab ?? null
  }

  /** The page in the window you're using: a Little window's page, or the main window's active tab. */
  focusedWebContents(): Electron.WebContents | null {
    const little = this.focusedLittle()
    if (little) return this.views.get(little.tab.id)?.webContents ?? null
    return this.activeWebContents()
  }

  focusedLittle(): { tab: TabItem; win: BrowserWindow } | null {
    const focused = BrowserWindow.getFocusedWindow()
    for (const little of this.littles.values()) if (little.win === focused) return little
    return null
  }

  activeTabId(): string | null {
    const space = activeSpace(this.state)
    if (!space.activeId) return null
    const loc = locate(this.state, space.activeId)
    if (!loc) return null
    if (loc.item.kind === 'tab') return loc.item.id
    if (loc.item.kind === 'split') return loc.item.focusedId ?? loc.item.tabs[0]?.id ?? null
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

  makeTab(url: string, title?: string, favicon?: string): TabItem {
    const now = Date.now()
    return { kind: 'tab', id: newId(), url, title: title || url || 'New Tab', favicon, createdAt: now, lastViewedAt: now }
  }

  newTab(url = '', activate = true, openerId?: string): TabItem {
    const space = activeSpace(this.state)
    const tab = this.makeTab(url)
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
    // Clicking a tab inside a split shows the whole split, focused on that tab.
    space.activeId = loc.split ? loc.split.id : id
    if (loc.split) loc.split.focusedId = id
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
    if (loc.split) {
      // One pane of a split closes; the rest stay side by side.
      removeFromSplit(this.state, id)
      if (loc.zone === 'today') this.archive.add(tab, space.id, true)
      if (space.activeId) this.activate(space.activeId)
    } else if (loc.zone !== 'today') {
      // Pinned tabs and favorites never disappear when closed: they just go to sleep.
      if (tab.pinnedUrl) tab.url = tab.pinnedUrl
      if (wasActive) this.showNext(space, id)
    } else {
      loc.list.splice(loc.index, 1)
      this.archive.add(tab, space.id, true)
      if (wasActive) {
        // Prefer the neighbour below, like closing a tab in a list.
        const next = loc.list[loc.index] ?? loc.list[loc.index - 1]
        if (next && next.kind !== 'folder') this.activate(next.id)
        else this.showNext(space, id)
      }
      // A Tidy folder that's now empty goes away.
      space.today = pruneEmptyFolders(space.today)
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
    const keep = (space: Space, list: SidebarItem[]): SidebarItem[] =>
      list.filter((item) => {
        if (item.kind === 'folder') {
          item.children = keep(space, item.children)
          return true
        }
        if (item.id === space.activeId) return true
        const tabs = item.kind === 'tab' ? [item] : item.tabs
        if (tabs.some((t) => t.lastViewedAt > cutoff || this.isAttached(t.id))) return true
        for (const tab of tabs) {
          this.destroyView(tab.id)
          this.archive.add(tab, space.id, false)
        }
        changed = true
        return false
      })
    for (const space of this.state.spaces) {
      space.today = keep(space, space.today)
      if (changed) space.today = pruneEmptyFolders(space.today)
    }
    if (changed) this.store.changed()
  }

  /** Checked-off to-dos disappear a week after you check them. */
  purgeDoneTodos(): void {
    const cutoff = Date.now() - DONE_TODO_KEEP_MS
    const before = this.state.todos.length
    this.state.todos = this.state.todos.filter((t) => !(t.done && (t.doneAt ?? 0) < cutoff))
    if (this.state.todos.length !== before) this.store.changed()
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

  // ---------- Peek ----------

  /** Show a link in a floating preview card over the current page. */
  openPeek(url: string): void {
    const peek = this.store.peek
    if (peek) {
      this.views.get(peek.id)?.webContents.loadURL(url).catch(() => {})
      return
    }
    this.store.peek = this.makeTab(url)
    this.focusOnAttach = this.store.peek.id
    this.store.changed(false)
  }

  closePeek(): void {
    const peek = this.store.peek
    if (!peek) return
    this.store.peek = null
    this.peekRect = null
    this.destroyView(peek.id)
    this.store.changed(false)
    this.layoutMain()
  }

  /** Turn the Peek into a real tab (the page keeps its place; no reload). */
  expandPeek(): void {
    const peek = this.store.peek
    if (!peek) return
    this.store.peek = null
    this.peekRect = null
    activeSpace(this.state).today.unshift(peek)
    this.activate(peek.id)
    this.store.changed()
  }

  // ---------- Little windows ----------

  /** A small, minimal window for a quick look at something. */
  openLittle(url = '', isPrivate = false): BrowserWindow {
    const tab = this.makeTab(url)
    if (isPrivate) tab.private = true
    const win = new BrowserWindow({
      width: 960,
      height: 680,
      minWidth: 420,
      minHeight: 300,
      title: 'VAIA',
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 14, y: 14 },
      vibrancy: 'sidebar',
      visualEffectState: 'active',
      backgroundColor: '#00000000',
      show: false,
      webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false, sandbox: true }
    })
    this.littles.set(tab.id, { tab, win })
    this.store.littles[tab.id] = tab
    this.store.subscribe(win.webContents)
    this.hardenUiWindow(win)
    win.once('ready-to-show', () => win.show())
    win.on('closed', () => {
      // Still a Little window's tab (not moved to the main window): close its page.
      if (this.littles.has(tab.id)) {
        this.littles.delete(tab.id)
        delete this.store.littles[tab.id]
        this.destroyView(tab.id)
        this.store.changed(false)
      }
      this.attached.delete(win)
      // A private window's cookies and site data are wiped when it closes.
      if (isPrivate) {
        const ses = session.fromPartition(`private-${tab.id}`)
        ses.clearStorageData().catch(() => {})
        ses.clearCache().catch(() => {})
      }
    })
    if (url) this.focusOnAttach = tab.id
    loadUi(win, `little&id=${tab.id}`)
    this.store.changed(false)
    return win
  }

  /** Move a Little window's page into the main window as a Today tab. */
  littleToMain(tabId: string): void {
    const little = this.littles.get(tabId)
    // Private pages never move into the main window (it would keep them).
    if (!little || little.tab.private) return
    this.littles.delete(tabId)
    delete this.store.littles[tabId]
    if (!this.win) this.createWindow()
    activeSpace(this.state).today.unshift(little.tab)
    this.activate(tabId)
    little.win.close()
    this.win?.show()
    this.win?.focus()
    this.store.changed()
  }

  /** Links from other apps (when VAIA is the default browser) open in a Little window. */
  openExternalLink(url: string): void {
    this.openLittle(url)
  }

  // ---------- Bookmarks ----------

  /** Bring in bookmarks from Chrome, Safari or a file, as a pinned folder or as Favorites. */
  async importBookmarks(source: 'chrome' | 'safari' | 'file', target: 'pinned' | 'favorites'): Promise<string> {
    let tree: BookmarkTree
    try {
      if (source === 'chrome') tree = readChrome()
      else if (source === 'safari') tree = await readSafari()
      else {
        const win = BrowserWindow.getFocusedWindow()
        const options = {
          title: 'Import Bookmarks',
          message: 'Choose a bookmarks file exported from Safari, Chrome, Firefox or another browser',
          properties: ['openFile' as const],
          filters: [{ name: 'Bookmarks', extensions: ['html', 'htm'] }]
        }
        const picked = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
        if (picked.canceled || !picked.filePaths[0]) return ''
        tree = readHtmlFile(picked.filePaths[0])
      }
    } catch (err) {
      return err instanceof ImportError ? err.message : 'Those bookmarks couldn’t be read.'
    }
    const name = source === 'chrome' ? 'Chrome' : source === 'safari' ? 'Safari' : 'Imported'
    if (target === 'favorites') {
      const have = new Set(this.state.favorites.map((t) => t.pinnedUrl ?? t.url))
      const links = tree.bar.filter((n): n is { title: string; url: string } => 'url' in n && !have.has(n.url)).slice(0, 24)
      for (const link of links) {
        const tab = this.makeTab(link.url, link.title)
        tab.pinnedUrl = link.url
        this.state.favorites.push(tab)
      }
      this.store.changed()
      return links.length ? `Added ${links.length} favorite${links.length === 1 ? '' : 's'}` : 'No new bookmarks bar links to add'
    }
    const toItems = (nodes: BookmarkNode[]): SidebarItem[] =>
      nodes.map((n): SidebarItem => {
        if ('url' in n) {
          const tab = this.makeTab(n.url, n.title)
          tab.pinnedUrl = n.url
          return tab
        }
        return { kind: 'folder', id: newId(), name: n.title, collapsed: true, children: toItems(n.children) }
      })
    const count = countLinks(tree.all)
    if (!count) return 'No bookmarks found'
    const folder: FolderItem = { kind: 'folder', id: newId(), name: `${name} Bookmarks`, collapsed: false, children: toItems(tree.all) }
    activeSpace(this.state).pinned.push(folder)
    this.store.changed()
    return `Imported ${count} bookmark${count === 1 ? '' : 's'} into “${folder.name}”`
  }

  makeDefaultBrowser(): boolean {
    // In development this would make the bare Electron app the default browser; only the real app may.
    if (!app.isPackaged) return false
    app.setAsDefaultProtocolClient('http')
    app.setAsDefaultProtocolClient('https')
    return true
  }

  // ---------- Boosts ----------

  private boostFor(url: string) {
    const site = siteKey(url)
    return site ? this.state.boosts[site] : undefined
  }

  /**
   * Swap the page's Boost style sheet for the current version (or remove it).
   * Runs one at a time per tab, so quick changes (dragging a color) can't leave stray style sheets behind.
   */
  private applyBoostCss(tabId: string): Promise<void> {
    const next = (this.boostQueue.get(tabId) ?? Promise.resolve()).then(() => this.swapBoostCss(tabId))
    this.boostQueue.set(tabId, next.catch(() => {}))
    return next
  }

  private async swapBoostCss(tabId: string): Promise<void> {
    const wc = this.views.get(tabId)?.webContents
    if (!wc || wc.isDestroyed()) return
    const old = this.boostCssKeys.get(tabId)
    this.boostCssKeys.delete(tabId)
    if (old) await wc.removeInsertedCSS(old).catch(() => {})
    const boost = this.boostFor(wc.getURL())
    const css = boost?.enabled ? boostCss(boost) : ''
    if (css) {
      // Every Boost rule is !important, so it wins over the site's own styles.
      // (Not cssOrigin "user": Electron can't remove those again, which breaks turning a Boost off.)
      const key = await wc.insertCSS(css).catch(() => null)
      if (key) this.boostCssKeys.set(tabId, key)
    }
  }

  /** After a Boost changes, update every open page of that site. */
  private refreshBoost(site: string): void {
    for (const id of this.views.keys()) {
      const url = this.views.get(id)?.webContents.getURL() ?? ''
      if (siteKey(url) === site) this.applyBoostCss(id)
    }
  }

  updateBoost(site: string, patch: Partial<Boost>): void {
    const boost = { ...EMPTY_BOOST, ...this.state.boosts[site], ...patch }
    this.state.boosts[site] = boost
    this.store.changed()
    this.refreshBoost(site)
  }

  /** Zap mode: click things on the page to hide them, until Esc. */
  async startZap(tabId: string): Promise<void> {
    const wc = this.views.get(tabId)?.webContents
    const site = wc ? siteKey(wc.getURL()) : null
    if (!wc || !site || this.zapping.has(tabId)) return
    this.zapping.add(tabId)
    wc.focus()
    while (this.zapping.has(tabId) && !wc.isDestroyed()) {
      const selector = (await wc.executeJavaScript(ZAP_SCRIPT, true).catch(() => null)) as string | null
      if (!selector) break
      const boost = this.state.boosts[site] ?? EMPTY_BOOST
      if (!boost.zaps.includes(selector)) this.updateBoost(site, { zaps: [...boost.zaps, selector], enabled: true })
    }
    this.zapping.delete(tabId)
    this.notify({ type: 'zap-ended' })
  }

  stopZap(tabId: string): void {
    this.zapping.delete(tabId)
    this.views.get(tabId)?.webContents.executeJavaScript('window.__vaiaStopZap?.()').catch(() => {})
  }

  // ---------- Tidy ----------

  /** Tidy the current Space's Today tabs, with Claude if that's switched on. */
  async tidy(): Promise<void> {
    if (this.tidying) return
    const space = activeSpace(this.state)
    const before = structuredClone(space.today)
    let result: TidyResult | null = null
    let fallbackReason = ''
    if (this.state.settings.aiTidy) {
      this.tidying = true
      try {
        // Work on a copy so nothing moves until Claude's answer arrives.
        const draft = structuredClone(space)
        const { tabs, lines, removed } = tidyInput(draft)
        if (lines.length >= 2) {
          this.showToast('Tidying with Claude…', { duration: 20000 })
          const plan = await aiTidyPlan(lines)
          // Tabs may have been closed or moved while we waited: only use the answer if nothing changed.
          if (layoutOf(space.today) !== layoutOf(before)) throw new AiTidyError('Tabs changed while tidying')
          result = applyAiPlan(draft, tabs, plan, removed)
          space.today = draft.today
        }
      } catch (err) {
        fallbackReason = err instanceof AiTidyError ? err.message : 'AI Tidy failed'
        if (!(err instanceof AiTidyError)) console.error('[tidy]', err)
      } finally {
        this.tidying = false
      }
    }
    result ??= simpleTidy(space)
    for (const tab of result.removed) {
      if (space.activeId === tab.id) space.activeId = null
      this.destroyView(tab.id)
    }
    if (!result.changed) {
      this.showToast(fallbackReason ? `${fallbackReason} · Already tidy` : 'Already tidy')
      return
    }
    this.tidyUndo = { spaceId: space.id, today: before }
    this.store.changed()
    const parts = [
      result.folders ? `${result.folders} folder${result.folders === 1 ? '' : 's'}` : '',
      result.removed.length ? `${result.removed.length} duplicate${result.removed.length === 1 ? '' : 's'} closed` : ''
    ].filter(Boolean)
    const summary = `Tidied${parts.length ? `: ${parts.join(', ')}` : ''}`
    this.showToast(fallbackReason ? `${fallbackReason}, used Simple Tidy. ${summary}` : summary, {
      action: { label: 'Undo', run: () => this.undoTidy() }
    })
  }

  /** Put Today back exactly as it was before the last Tidy. */
  undoTidy(): void {
    const undo = this.tidyUndo
    this.tidyUndo = null
    const space = undo && this.state.spaces.find((s) => s.id === undo.spaceId)
    if (!undo || !space) return
    space.today = undo.today
    if (!space.activeId) {
      const first = tabsIn(space.today)[0]
      if (first && space.id === this.state.activeSpaceId) this.activate(first.id)
    }
    this.store.changed()
  }

  // ---------- To-dos ----------

  addTodo(text: string, spaceId: string | null, due?: string, linkTabId?: string): string | null {
    const clean = text.trim()
    if (!clean) return null
    const tab = linkTabId ? this.tab(linkTabId) : null
    const todo: Todo = {
      id: newId(),
      text: clean,
      done: false,
      due: due || undefined,
      link: tab?.url ? { url: tab.url, title: tab.name || tab.title } : undefined,
      spaceId,
      createdAt: Date.now()
    }
    // New to-dos go on top of the list (above the others that are still open).
    this.state.todos.unshift(todo)
    this.store.changed()
    return todo.id
  }

  /** Open a to-do's linked page: switch to it if it's already open, otherwise open a tab. */
  openTodoLink(id: string): void {
    const link = this.state.todos.find((t) => t.id === id)?.link
    if (!link) return
    if (!this.win) this.createWindow()
    this.win?.show()
    this.win?.focus()
    const current = activeSpace(this.state)
    const open = allTabs(this.state).filter((t) => sameUrl(t.url, link.url))
    const match = open.find((t) => locate(this.state, t.id)?.space === current) ?? open[0]
    if (match) {
      const space = locate(this.state, match.id)?.space
      if (space && space !== current) this.switchSpace(space.id)
      this.activate(match.id)
    } else {
      this.newTab(link.url)
    }
    this.store.changed()
  }

  /** Move a to-do so it sits just before another one (null = the end). */
  moveTodo(id: string, beforeId: string | null): void {
    const todos = this.state.todos
    const from = todos.findIndex((t) => t.id === id)
    if (from < 0 || id === beforeId) return
    const [todo] = todos.splice(from, 1)
    const to = beforeId ? todos.findIndex((t) => t.id === beforeId) : -1
    todos.splice(to < 0 ? todos.length : to, 0, todo)
    this.store.changed()
  }

  /** The to-do list in its own small window that can float above everything. */
  openTodoWindow(): void {
    if (this.todoWin && !this.todoWin.isDestroyed()) {
      this.todoWin.show()
      this.todoWin.focus()
      return
    }
    const win = new BrowserWindow({
      width: 340,
      height: 520,
      minWidth: 260,
      minHeight: 240,
      title: 'VAIA To-do',
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 14, y: 14 },
      vibrancy: 'sidebar',
      visualEffectState: 'active',
      backgroundColor: '#00000000',
      show: false,
      webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false, sandbox: true }
    })
    this.todoWin = win
    if (this.state.settings.todoWindowOnTop) win.setAlwaysOnTop(true, 'floating')
    this.store.subscribe(win.webContents)
    this.hardenUiWindow(win)
    win.once('ready-to-show', () => win.show())
    win.on('closed', () => (this.todoWin = null))
    loadUi(win, 'todo')
  }

  // ---------- Split View ----------

  /**
   * Put a tab (an existing one, or a new one for `url`) next to what's on screen.
   * Pinned tabs and favorites are copied rather than moved, so they stay where they are.
   */
  splitAdd(opts: { tabId?: string; url?: string; blank?: boolean; side?: 'left' | 'right' }): void {
    const space = activeSpace(this.state)
    let baseId = space.activeId
    if (!baseId) {
      if (opts.tabId) this.activate(opts.tabId)
      else if (opts.url) this.newTab(opts.url)
      return
    }
    let add: TabItem | null = null
    if (opts.tabId) {
      if (opts.tabId === baseId) return
      const loc = locate(this.state, opts.tabId)
      if (!loc || loc.item.kind !== 'tab') return
      if (loc.split && loc.split.id === baseId) return
      if (loc.split) detachFromSplit(this.state, opts.tabId)
      const fresh = locate(this.state, opts.tabId)!
      if (fresh.zone === 'today') {
        fresh.list.splice(fresh.index, 1)
        add = fresh.item as TabItem
      } else {
        const original = fresh.item as TabItem
        add = this.makeTab(original.url, original.title, original.favicon)
      }
    } else if (opts.url || opts.blank) {
      add = this.makeTab(opts.url ?? '')
    }
    if (!add) return
    // A favorite on screen can't become a split itself: split a copy of it instead.
    const base = locate(this.state, baseId)
    if (base?.zone === 'favorites' && base.item.kind === 'tab') {
      const copy = this.makeTab(base.item.url, base.item.title, base.item.favicon)
      space.today.unshift(copy)
      space.activeId = baseId = copy.id
    }
    const split = addToSplit(this.state, baseId, add, opts.side ?? 'right')
    if (!split) {
      // Already 4 panes (or nothing to split): open it as a normal tab instead.
      space.today.unshift(add)
      this.activate(add.id)
    } else {
      space.activeId = split.id
      this.focusOnAttach = add.id
    }
    this.store.changed()
  }

  /** Give the split on screen (or the given tab, made into a split) a ready-made layout. */
  splitLayout(id: string, preset: SplitPreset): void {
    let loc = locate(this.state, id)
    if (!loc) return
    if (loc.item.kind === 'tab' && !loc.split) {
      // A single tab: show it, then split it with an empty pane.
      const space = loc.space
      if (space && space.id !== this.state.activeSpaceId) this.switchSpace(space.id)
      this.activate(id)
      this.splitAdd({ blank: true })
      loc = locate(this.state, activeSpace(this.state).activeId ?? '')
    }
    const split = loc?.split ?? (loc?.item.kind === 'split' ? loc.item : null)
    if (!split) return
    applySplitPreset(this.state, split.id, preset, () => this.makeTab(''))
    this.store.changed()
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
    // Its to-dos aren't lost: they become "Everywhere" to-dos.
    for (const todo of this.state.todos) if (todo.spaceId === id) todo.spaceId = null
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
        if (this.crashed.delete(action.id)) {
          // Bring a crashed page back: its view is created again on the next layout.
          delete this.store.runtime[action.id]
          this.store.changed(false)
          for (const win of BrowserWindow.getAllWindows()) this.relayout(win)
          return
        }
        return wc(action.id)?.reload()
      case 'tab/stop':
        return wc(action.id)?.stop()
      case 'tab/copyUrl': {
        const tab = this.tab(action.id)
        if (tab?.url) {
          clipboard.writeText(tab.url)
          this.showToast('Copied URL')
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
      case 'split/add':
        return this.splitAdd(action)
      case 'split/detach':
        detachFromSplit(this.state, action.tabId)
        return this.store.changed()
      case 'split/dissolve':
        dissolveSplit(this.state, action.id)
        return this.store.changed()
      case 'split/layout':
        return this.splitLayout(action.id, action.preset)
      case 'split/even':
        evenSplit(this.state, action.id)
        return this.store.changed()
      case 'split/resizeGrid': {
        const loc = locate(this.state, action.id)
        if (loc?.item.kind === 'split') {
          const clamp = (v: number) => Math.min(0.85, Math.max(0.15, v))
          loc.item.grid = { col: clamp(action.col), row: clamp(action.row) }
          this.store.changed()
        }
        return
      }
      case 'split/resize': {
        const loc = locate(this.state, action.id)
        if (loc?.item.kind === 'split' && action.sizes.length === loc.item.tabs.length) {
          loc.item.sizes = action.sizes
          this.store.changed()
        }
        return
      }
      case 'peek/close':
        return this.closePeek()
      case 'peek/expand':
        return this.expandPeek()
      case 'little/new':
        this.openLittle(action.url)
        return
      case 'little/toMain':
        return this.littleToMain(action.id)
      case 'app/makeDefaultBrowser': {
        const ok = this.makeDefaultBrowser()
        this.showToast(ok ? 'Asked macOS to make VAIA your default browser' : 'Available in the installed VAIA app')
        return ok
      }
      case 'tab/reopenClosed':
        return this.reopenClosed()
      case 'archive/restore':
        return this.restoreArchived(action.id)
      case 'archive/remove':
        return this.archive.remove(action.id)
      case 'archive/clear':
        return this.archive.clear()
      case 'tab/duplicate': {
        const tab = this.tab(action.id)
        if (tab?.url) this.newTab(tab.url, true, tab.id)
        return
      }
      case 'find/query': {
        const page = this.activeWebContents()
        if (!page) return
        if (!action.text) page.stopFindInPage('clearSelection')
        else page.findInPage(action.text, { forward: action.forward ?? true, findNext: action.next ?? false })
        return
      }
      case 'find/stop':
        this.activeWebContents()?.stopFindInPage('clearSelection')
        return
      case 'download/trash':
      case 'download/remove': {
        const entry = this.store.downloads.find((d) => d.id === action.id)
        if (!entry) return
        if (action.type === 'download/trash' && existsSync(entry.path)) {
          shell.trashItem(entry.path).catch(() => this.showToast('Couldn’t move that file to the Trash'))
        }
        this.store.downloads = this.store.downloads.filter((d) => d.id !== action.id)
        this.saveDownloads()
        return this.store.changed(false)
      }
      case 'download/open':
      case 'download/show':
      case 'download/cancel':
        return this.downloadAction(action.id, action.type.split('/')[1] as 'open' | 'show' | 'cancel')
      case 'downloads/clear':
        this.store.downloads = this.store.downloads.filter((d) => d.state === 'progressing')
        this.saveDownloads()
        return this.store.changed(false)
      case 'data/clear':
        return this.clearData(action)
      case 'history/remove':
        return this.history.remove(action.url)
      case 'app/openSettings':
        return this.openSettings()
      case 'app/editSpace':
        this.win?.show()
        this.win?.focus()
        return this.command({ type: 'edit-space', id: action.id })
      case 'boost/update':
        return this.updateBoost(action.site, action.patch)
      case 'boost/delete':
        delete this.state.boosts[action.site]
        this.store.changed()
        return this.refreshBoost(action.site)
      case 'boost/zapStart':
        return this.startZap(action.tabId)
      case 'boost/zapStop':
        return this.stopZap(action.tabId)
      case 'boost/runJs': {
        const wc = this.views.get(action.tabId)?.webContents
        const boost = wc ? this.boostFor(wc.getURL()) : undefined
        if (wc && boost?.js.trim()) wc.executeJavaScript(boost.js).catch(() => this.showToast('The script had an error'))
        return
      }
      case 'settings/update':
        if (action.patch.adBlock !== undefined) this.adblock.setEnabled(action.patch.adBlock)
        if (action.patch.todoWindowOnTop !== undefined && this.todoWin && !this.todoWin.isDestroyed()) {
          this.todoWin.setAlwaysOnTop(action.patch.todoWindowOnTop, 'floating')
        }
        Object.assign(this.state.settings, action.patch)
        if (action.patch.archiveAfter) this.autoArchive()
        this.store.changed()
        return
      case 'today/tidy':
        return this.tidy()
      case 'ai/setKey':
        return saveApiKey(action.key)
          .then(() => (this.store.aiKeySet = true))
          .catch((err) => {
            console.error('[ai] could not save key', err)
            this.showToast('Could not save the key securely')
          })
          .finally(() => this.store.changed(false))
      case 'ai/clearKey':
        clearApiKey()
        this.store.aiKeySet = false
        return this.store.changed(false)
      case 'todo/add': {
        const id = this.addTodo(action.text, action.spaceId, action.due, action.linkTabId)
        if (id && action.confirm) this.showToast('Added to your to-do list')
        return id
      }
      case 'todo/update': {
        const todo = this.state.todos.find((t) => t.id === action.id)
        if (!todo) return
        const { done, ...rest } = action.patch
        Object.assign(todo, rest)
        if (done !== undefined && done !== todo.done) {
          todo.done = done
          todo.doneAt = done ? Date.now() : undefined
        }
        if (todo.text.trim() === '') todo.text = 'Untitled'
        return this.store.changed()
      }
      case 'todo/delete':
        this.state.todos = this.state.todos.filter((t) => t.id !== action.id)
        return this.store.changed()
      case 'todo/move':
        return this.moveTodo(action.id, action.beforeId)
      case 'todo/open':
        return this.openTodoLink(action.id)
      case 'todo/linkActive': {
        const todo = this.state.todos.find((t) => t.id === action.id)
        const id = this.activeTabId()
        const tab = id ? this.tab(id) : null
        if (todo && tab?.url) {
          todo.link = { url: tab.url, title: tab.name || tab.title }
          this.store.changed()
        }
        return
      }
      case 'todo/clearDone':
        this.state.todos = this.state.todos.filter((t) => !t.done)
        return this.store.changed()
      case 'todo/popout':
        return this.openTodoWindow()
      case 'permissions/set':
        return this.permissions.set(action.origin, action.kind, action.decision)
      case 'permissions/resetSite':
        return this.permissions.resetSite(action.origin)
      case 'permissions/resetAll':
        return this.permissions.resetAll()
      case 'extensions/setEnabled': {
        const disabled = new Set(this.state.settings.disabledExtensions)
        if (action.enabled) disabled.delete(action.id)
        else disabled.add(action.id)
        this.state.settings.disabledExtensions = [...disabled]
        this.store.changed()
        return this.extensions.setEnabled(action.id, action.enabled)
      }
      case 'extensions/remove':
        this.state.settings.disabledExtensions = this.state.settings.disabledExtensions.filter((id) => id !== action.id)
        this.store.changed()
        return this.extensions.remove(action.id)
      case 'extensions/installById':
        return this.extensions.installById(action.id)
      case 'extensions/openStore':
        if (!this.win) this.createWindow()
        this.win?.focus()
        this.newTab('https://chromewebstore.google.com/category/extensions')
        return
      case 'private/new':
        return void this.openLittle(action.url, true)
      case 'tab/print':
        return this.print(action.id)
      case 'bookmarks/import':
        return this.importBookmarks(action.source, action.target)
    }
  }
}

/** Which items are where (ignoring titles and icons, which change as pages load). */
function layoutOf(list: SidebarItem[]): string {
  return JSON.stringify(list, (key, value) => (key === 'title' || key === 'favicon' || key === 'lastViewedAt' ? undefined : value))
}

/** example.com for www.example.com, mail.example.com, etc. (good enough for "same site"). */
function siteOf(url: string): string {
  try {
    return new URL(url).hostname.split('.').slice(-2).join('.')
  } catch {
    return ''
  }
}

/** Sign-in pages must open normally, never in Peek, or logging in breaks. */
function isAuthUrl(url: string): boolean {
  try {
    const { hostname, pathname } = new URL(url)
    return (
      /^(accounts|login|auth|sso|signin|id|oauth)\./.test(hostname) ||
      /(^|\.)(okta|auth0|microsoftonline|appleid\.apple)\./.test(hostname) ||
      /\/(login|signin|sign-in|oauth|authorize|sso)\b/.test(pathname)
    )
  } catch {
    return false
  }
}

/** ~/Downloads/report.pdf, or report (1).pdf if that name is taken. */
function uniquePath(dir: string, filename: string): string {
  const ext = extname(filename)
  const stem = filename.slice(0, filename.length - ext.length) || 'download'
  let candidate = join(dir, filename || 'download')
  for (let n = 1; existsSync(candidate); n++) candidate = join(dir, `${stem} (${n})${ext}`)
  return candidate
}

function originOf(url: string): string {
  try {
    return new URL(url).origin
  } catch {
    return ''
  }
}
