// Library → Media: the pictures, videos and PDFs you downloaded, and (if you turn
// it on) the screenshots in your Mac's screenshots folder. The interface shows
// them through vaia-media:// links, which only ever serve files listed here.
import { ClipboardItem, clipboard, nativeImage, net, protocol, shell } from 'electron'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, extname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import type { DownloadItem, MediaItem, MediaList } from '../shared/types'

export const MEDIA_SCHEME = 'vaia-media'
/** macOS's own clipboard type for "a file" (what Finder puts there when you copy one). */
const FILE_URL_FORMAT = 'electron application/osclipboard;format="public.file-url"'

const KINDS: Record<string, MediaItem['kind']> = {
  '.png': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.gif': 'image',
  '.webp': 'image',
  '.heic': 'image',
  '.avif': 'image',
  '.bmp': 'image',
  '.tif': 'image',
  '.tiff': 'image',
  '.svg': 'image',
  '.mp4': 'video',
  '.mov': 'video',
  '.m4v': 'video',
  '.webm': 'video',
  '.pdf': 'pdf'
}

/** The names macOS gives screenshots and screen recordings (English and a few common languages). */
const SCREENSHOT_NAME = /^(Screenshot|Screen Shot|Screen Recording|Bildschirmfoto|Capture d.écran|Captura de pantalla|Schermafbeelding|Istantanea|スクリーンショット)/i

/** Where macOS saves screenshots: your choice in the Screenshot app, or the Desktop. */
async function screenshotsFolder(): Promise<string> {
  // Tests point this at a folder of their own.
  if (process.env.VAIA_SCREENSHOTS_DIR) return process.env.VAIA_SCREENSHOTS_DIR
  try {
    const { stdout } = await promisify(execFile)('/usr/bin/defaults', ['read', 'com.apple.screencapture', 'location'])
    const dir = stdout.trim().replace(/^~(?=\/|$)/, homedir())
    if (dir && existsSync(dir)) return dir
  } catch {
    // Never changed: macOS uses the Desktop.
  }
  return join(homedir(), 'Desktop')
}

export class Media {
  /** The files the interface may show or change: exactly the ones in the last list. */
  private allowed = new Set<string>()
  private thumbs = new Map<string, string | null>()

  constructor(
    private downloads: () => DownloadItem[],
    private includeScreenshots: () => boolean,
    private toast: (text: string) => void,
    private forgetDownload: (path: string) => void
  ) {}

  async list(): Promise<MediaList> {
    const items: MediaItem[] = []
    for (const d of this.downloads()) {
      const kind = KINDS[extname(d.path).toLowerCase()]
      if (d.state !== 'completed' || !kind || !existsSync(d.path)) continue
      items.push({ path: d.path, name: basename(d.path), kind, size: d.total || d.received, time: d.startedAt, source: 'download' })
    }
    const result: MediaList = { items }
    if (this.includeScreenshots()) {
      const dir = await screenshotsFolder()
      result.screenshotsFolder = dir
      // The first time, macOS asks whether VAIA may see this folder (e.g. the Desktop).
      // If you said no, reading it fails and the Library explains how to allow it.
      try {
        const onDesktop = dir === join(homedir(), 'Desktop')
        const seen = new Set(items.map((i) => i.path))
        for (const name of await readdir(dir)) {
          const kind = KINDS[extname(name).toLowerCase()]
          if (!kind || kind === 'pdf' || name.startsWith('.')) continue
          // On the Desktop only real screenshots; in a folder just for screenshots, everything.
          if (onDesktop && !SCREENSHOT_NAME.test(name)) continue
          const path = join(dir, name)
          if (seen.has(path)) continue
          const info = await stat(path).catch(() => null)
          if (info?.isFile()) items.push({ path, name, kind, size: info.size, time: info.birthtimeMs || info.mtimeMs, source: 'screenshot' })
        }
      } catch {
        result.screenshotsBlocked = true
      }
    }
    items.sort((a, b) => b.time - a.time)
    this.allowed = new Set(items.map((i) => i.path))
    return result
  }

  /** A Quick Look picture of the file (works for pictures, videos and PDFs). Cached. */
  async thumbnail(path: string, size: number): Promise<string | null> {
    if (!this.allowed.has(path)) return null
    const width = Math.max(64, Math.min(1600, Math.round(size)))
    const key = `${width}:${path}`
    if (this.thumbs.has(key)) return this.thumbs.get(key)!
    let url: string | null = null
    try {
      const image = await nativeImage.createThumbnailFromPath(path, { width, height: width })
      if (!image.isEmpty()) url = image.toDataURL()
    } catch {
      url = null
    }
    this.thumbs.set(key, url)
    return url
  }

  /** Serve listed files to the interface: vaia-media://file/<the file's path, encoded>. */
  registerProtocol(): void {
    protocol.handle(MEDIA_SCHEME, (request) => {
      const path = decodeURIComponent(new URL(request.url).pathname.slice(1))
      if (!this.allowed.has(path)) return new Response('Not found', { status: 404 })
      return net.fetch(pathToFileURL(path).href, { headers: request.headers })
    })
  }

  async act(what: 'open' | 'show' | 'copy' | 'trash', path: string): Promise<void> {
    if (!this.allowed.has(path)) return
    if (!existsSync(path)) return this.toast('That file was moved or deleted')
    if (what === 'open') {
      shell.openPath(path)
    } else if (what === 'show') {
      shell.showItemInFolder(path)
    } else if (what === 'copy') {
      const kind = KINDS[extname(path).toLowerCase()]
      const image = kind === 'image' ? nativeImage.createFromPath(path) : null
      try {
        if (image && !image.isEmpty()) {
          await clipboard.write([new ClipboardItem({ 'image/png': new Blob([image.toPNG()], { type: 'image/png' }) })])
          this.toast('Copied picture')
        } else {
          // Copy the file itself, ready to paste into Finder, Mail or Messages.
          await clipboard.write([new ClipboardItem({ [FILE_URL_FORMAT]: pathToFileURL(path).href })])
          this.toast('Copied file')
        }
      } catch {
        this.toast('Couldn’t copy that file')
      }
    } else {
      try {
        await shell.trashItem(path)
      } catch {
        return this.toast('Couldn’t move that file to the Trash')
      }
      this.allowed.delete(path)
      this.forgetDownload(path)
      this.toast('Moved to the Trash')
    }
  }
}
