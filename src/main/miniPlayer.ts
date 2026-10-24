// The Mini Player's floating view. Web pages are always drawn above VAIA's own
// interface, so (like toasts) the Mini Player is its own small view placed on
// top of the page area. It runs VAIA's interface code (?view=mini).
import { BrowserWindow, WebContentsView, screen } from 'electron'
import type { Corner, Rect } from '../shared/types'

const WIDTH = 320
const HEIGHT = 72
const MARGIN = 14

export class MiniPlayerView {
  view: WebContentsView | null = null
  private area: Rect | null = null
  private dragTimer: NodeJS.Timeout | null = null

  constructor(
    private preload: string,
    private load: (wc: Electron.WebContents) => void,
    private corner: () => Corner,
    private setCorner: (corner: Corner) => void,
    private subscribe: (wc: Electron.WebContents) => void
  ) {}

  get webContents(): Electron.WebContents | null {
    return this.view?.webContents ?? null
  }

  /** Show in the given page area of the window (or hide with null). Keeps it above the pages. */
  place(win: BrowserWindow, area: Rect | null): void {
    this.area = area
    if (!area) {
      this.view?.setVisible(false)
      return
    }
    if (!this.view) {
      this.view = new WebContentsView({ webPreferences: { preload: this.preload, contextIsolation: true, sandbox: true } })
      this.view.setBackgroundColor('#00000000')
      this.view.setBorderRadius(14)
      this.subscribe(this.view.webContents)
      this.view.webContents.on('will-navigate', (e) => e.preventDefault())
      this.view.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
      this.load(this.view.webContents)
    }
    if (!this.dragTimer) this.view.setBounds(this.cornerBounds(area, this.corner()))
    this.view.setVisible(true)
    // Adding a view that's already there moves it to the top.
    win.contentView.addChildView(this.view)
  }

  private cornerBounds(area: Rect, corner: Corner): Rect {
    const x = corner.endsWith('left') ? area.x + MARGIN : area.x + area.width - WIDTH - MARGIN
    const y = corner.startsWith('top') ? area.y + MARGIN : area.y + area.height - HEIGHT - MARGIN
    return { x: Math.round(x), y: Math.round(y), width: WIDTH, height: HEIGHT }
  }

  /** Follow the mouse while you drag the player; let go and it settles in the nearest corner. */
  dragStart(win: BrowserWindow): void {
    if (!this.view || !this.area || this.dragTimer) return
    const content = win.getContentBounds()
    const start = this.view.getBounds()
    const cursor = screen.getCursorScreenPoint()
    const offset = { x: cursor.x - content.x - start.x, y: cursor.y - content.y - start.y }
    const area = this.area
    const startedAt = Date.now()
    this.dragTimer = setInterval(() => {
      // Safety net: never follow the mouse for more than 20 seconds.
      if (!this.view || win.isDestroyed() || Date.now() - startedAt > 20_000) return this.dragEnd()
      const p = screen.getCursorScreenPoint()
      const x = Math.min(Math.max(p.x - content.x - offset.x, area.x), area.x + area.width - WIDTH)
      const y = Math.min(Math.max(p.y - content.y - offset.y, area.y), area.y + area.height - HEIGHT)
      this.view.setBounds({ x: Math.round(x), y: Math.round(y), width: WIDTH, height: HEIGHT })
    }, 16)
  }

  dragEnd(): void {
    if (!this.dragTimer) return
    clearInterval(this.dragTimer)
    this.dragTimer = null
    if (!this.view || !this.area) return
    const b = this.view.getBounds()
    const left = b.x + b.width / 2 < this.area.x + this.area.width / 2
    const top = b.y + b.height / 2 < this.area.y + this.area.height / 2
    const corner: Corner = `${top ? 'top' : 'bottom'}-${left ? 'left' : 'right'}`
    this.setCorner(corner)
    this.view.setBounds(this.cornerBounds(this.area, corner))
  }

  destroy(): void {
    this.dragEnd()
    this.view?.webContents.close()
    this.view = null
  }
}
