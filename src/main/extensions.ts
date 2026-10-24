// Chrome extensions, installed from the Chrome Web Store.
// electron-chrome-extensions provides the chrome.* APIs (tabs, popups, ...);
// electron-chrome-web-store makes "Add to Chrome" work and keeps them updated.
// Extensions run in your normal browsing profile only (not in Spaces with a
// separate profile, and never in private windows).
import { BrowserWindow, dialog, nativeImage, session, type Session, type WebContents } from 'electron'
import { ElectronChromeExtensions } from 'electron-chrome-extensions'
import { installChromeWebStore, installExtension, uninstallExtension } from 'electron-chrome-web-store'
import { join } from 'node:path'
import type { ExtensionInfo } from '../shared/types'

export const EXTENSIONS_PARTITION = 'persist:default'

export interface ExtensionHost {
  /** Open a tab for chrome.tabs.create; returns its page and window. */
  createTab(url: string, active: boolean): Promise<[WebContents, BrowserWindow]>
  selectTab(wc: WebContents): void
  removeTab(wc: WebContents): void
  createWindow(url: string): Promise<BrowserWindow>
  disabled(): string[]
  onChange(list: ExtensionInfo[]): void
}

export class Extensions {
  chrome: ElectronChromeExtensions | null = null
  private ses: Session | null = null
  /** Where each extension lives on disk (kept for disabled ones, so they can be turned back on). */
  private paths = new Map<string, { path: string; name: string; version: string; icon?: string }>()

  constructor(private host: ExtensionHost) {}

  async init(ses: Session): Promise<void> {
    this.ses = ses
    // The sidebar's extension buttons show their icons via crx:// in VAIA's own interface.
    ElectronChromeExtensions.handleCRXProtocol(session.defaultSession)
    this.chrome = new ElectronChromeExtensions({
      license: 'GPL-3.0',
      session: ses,
      createTab: (details) => this.host.createTab(details.url ?? '', details.active !== false),
      selectTab: (wc) => this.host.selectTab(wc),
      removeTab: (wc) => this.host.removeTab(wc),
      createWindow: (details) => this.host.createWindow([details.url ?? ''].flat()[0] ?? '')
    })
    ses.extensions.on('extension-loaded', () => this.refresh())
    ses.extensions.on('extension-unloaded', () => this.refresh())
    try {
      await installChromeWebStore({
        session: ses,
        beforeInstall: async (details) => {
          const win = details.browserWindow ?? BrowserWindow.getFocusedWindow()
          const options = {
            type: 'question' as const,
            message: `Add “${details.localizedName}” to VAIA?`,
            detail: 'Extensions can read and change web pages you visit. Only add extensions you trust.',
            buttons: ['Add Extension', 'Cancel'],
            defaultId: 0,
            cancelId: 1,
            icon: details.icon.isEmpty() ? undefined : details.icon
          }
          const { response } = win ? await dialog.showMessageBox(win, options) : await dialog.showMessageBox(options)
          return { action: response === 0 ? 'allow' : 'deny' }
        }
      })
    } catch (err) {
      console.error('[extensions] could not start the Chrome Web Store support', err)
    }
    // Turned-off extensions are loaded by the web store support; unload them again.
    for (const id of this.host.disabled()) {
      if (ses.extensions.getExtension(id)) ses.extensions.removeExtension(id)
    }
    this.refresh()
  }

  addTab(wc: WebContents, win: BrowserWindow): void {
    this.chrome?.addTab(wc, win)
  }

  selectTab(wc: WebContents): void {
    if (!wc.isDestroyed()) this.chrome?.selectTab(wc)
  }

  /** Extra right-click menu items that extensions added. */
  contextMenuItems(wc: WebContents, params: Electron.ContextMenuParams): Electron.MenuItem[] {
    return this.chrome?.getContextMenuItems(wc, params) ?? []
  }

  private refresh(): void {
    const ses = this.ses
    if (!ses) return
    for (const ext of ses.extensions.getAllExtensions()) {
      if (!this.paths.has(ext.id)) {
        this.paths.set(ext.id, { path: ext.path, name: ext.name, version: ext.version, icon: iconFor(ext) })
      } else {
        const known = this.paths.get(ext.id)!
        Object.assign(known, { path: ext.path, name: ext.name, version: ext.version })
      }
    }
    const loaded = new Set(ses.extensions.getAllExtensions().map((e) => e.id))
    const list: ExtensionInfo[] = [...this.paths.entries()]
      .map(([id, e]) => ({ id, name: e.name, version: e.version, icon: e.icon, enabled: loaded.has(id) }))
      .sort((a, b) => a.name.localeCompare(b.name))
    this.host.onChange(list)
  }

  async setEnabled(id: string, enabled: boolean): Promise<void> {
    const ses = this.ses
    const known = this.paths.get(id)
    if (!ses || !known) return
    if (!enabled && ses.extensions.getExtension(id)) ses.extensions.removeExtension(id)
    if (enabled && !ses.extensions.getExtension(id)) await ses.extensions.loadExtension(known.path).catch(() => {})
    this.refresh()
  }

  async remove(id: string): Promise<void> {
    const ses = this.ses
    if (!ses) return
    try {
      await uninstallExtension(id, { session: ses })
    } catch (err) {
      console.error('[extensions] uninstall failed', err)
      if (ses.extensions.getExtension(id)) ses.extensions.removeExtension(id)
    }
    this.paths.delete(id)
    this.refresh()
  }

  /** Install straight from the web store by extension id (used by tests and power users). */
  async installById(id: string): Promise<boolean> {
    if (!this.ses) return false
    try {
      await installExtension(id, { session: this.ses })
      return true
    } catch (err) {
      console.error('[extensions] install failed', err)
      return false
    }
  }
}

function iconFor(ext: Electron.Extension): string | undefined {
  const icons = (ext.manifest as { icons?: Record<string, string> }).icons
  if (!icons) return undefined
  const best = Object.keys(icons)
    .map(Number)
    .sort((a, b) => Math.abs(a - 32) - Math.abs(b - 32))[0]
  const image = nativeImage.createFromPath(join(ext.path, icons[String(best)]))
  return image.isEmpty() ? undefined : image.resize({ width: 32, height: 32 }).toDataURL()
}
