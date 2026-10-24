// Importing bookmarks from Chrome, Safari, or an exported bookmarks .html file.
// Everything is turned into one simple tree of folders and links first.
import { execFile } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

export type BookmarkNode = { title: string; url: string } | { title: string; children: BookmarkNode[] }

export interface BookmarkTree {
  /** The "Bookmarks Bar" / "Favorites" folder: what goes into Favorites. */
  bar: BookmarkNode[]
  /** Everything (including the bar), for a pinned folder. */
  all: BookmarkNode[]
}

export class ImportError extends Error {}

const isLink = (n: BookmarkNode): n is { title: string; url: string } => 'url' in n
const web = (url: string) => /^https?:\/\//i.test(url)

/** Drop non-web links and folders that end up empty. */
function clean(nodes: BookmarkNode[]): BookmarkNode[] {
  return nodes.flatMap((n): BookmarkNode[] => {
    if (isLink(n)) return web(n.url) ? [{ title: n.title.trim() || n.url, url: n.url }] : []
    const children = clean(n.children)
    return children.length ? [{ title: n.title.trim() || 'Folder', children }] : []
  })
}

// ---------- Chrome ----------

interface ChromeNode {
  type: 'url' | 'folder'
  name: string
  url?: string
  children?: ChromeNode[]
}

function fromChrome(node: ChromeNode): BookmarkNode {
  return node.type === 'url'
    ? { title: node.name, url: node.url ?? '' }
    : { title: node.name, children: (node.children ?? []).map(fromChrome) }
}

export function readChrome(): BookmarkTree {
  const file = join(homedir(), 'Library/Application Support/Google/Chrome/Default/Bookmarks')
  if (!existsSync(file)) throw new ImportError('Chrome bookmarks weren’t found on this Mac.')
  const data = JSON.parse(readFileSync(file, 'utf8')) as { roots: Record<string, ChromeNode> }
  const bar = data.roots.bookmark_bar ? fromChrome(data.roots.bookmark_bar) : null
  const rest = ['other', 'synced'].map((k) => data.roots[k]).filter((n): n is ChromeNode => !!n)
  const barChildren = bar && !isLink(bar) ? bar.children : []
  return {
    bar: clean(barChildren),
    all: clean([...(bar ? [{ ...bar, title: 'Bookmarks Bar' }] : []), ...rest.map(fromChrome)])
  }
}

// ---------- Safari ----------

type Plist = string | number | boolean | null | Plist[] | { [key: string]: Plist }

/** A tiny reader for Apple's XML property-list format (enough for Safari's bookmarks). */
function parsePlistXml(xml: string): Plist {
  const tokens = xml.match(/<[^>]+>|[^<]+/g) ?? []
  let i = 0
  const text = () => (tokens[i] && !tokens[i].startsWith('<') ? decodeEntities(tokens[i++]) : '')
  const value = (): Plist => {
    while (i < tokens.length && !/^<(dict|array|string|integer|real|true|false|data|date)\b/.test(tokens[i])) i++
    const tag = tokens[i++] ?? ''
    if (tag.startsWith('<dict')) {
      if (tag.endsWith('/>')) return {}
      const out: Record<string, Plist> = {}
      while (i < tokens.length && tokens[i] !== '</dict>') {
        if (tokens[i] === '<key>') {
          i++
          const key = text()
          i++ // </key>
          out[key] = value()
        } else i++
      }
      i++
      return out
    }
    if (tag.startsWith('<array')) {
      if (tag.endsWith('/>')) return []
      const out: Plist[] = []
      while (i < tokens.length && tokens[i] !== '</array>') {
        if (/^\s*$/.test(tokens[i]) || !tokens[i].startsWith('<')) i++
        else out.push(value())
      }
      i++
      return out
    }
    if (tag === '<true/>' || tag === '<false/>') return tag === '<true/>'
    if (tag.endsWith('/>')) return ''
    const content = text()
    i++ // closing tag
    if (tag === '<integer>' || tag === '<real>') return Number(content)
    if (tag === '<data>') return null
    return content
  }
  return value()
}

function fromSafari(node: Plist): BookmarkNode | null {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return null
  const type = node.WebBookmarkType
  if (type === 'WebBookmarkTypeLeaf') {
    const title = (node.URIDictionary as Record<string, Plist> | undefined)?.title
    return { title: String(title ?? node.URLString ?? ''), url: String(node.URLString ?? '') }
  }
  if (type === 'WebBookmarkTypeList') {
    const children = Array.isArray(node.Children) ? node.Children.map(fromSafari).filter((n): n is BookmarkNode => !!n) : []
    const names: Record<string, string> = { BookmarksBar: 'Favorites', BookmarksMenu: 'Bookmarks Menu' }
    const title = String(node.Title ?? '')
    return { title: names[title] ?? title, children }
  }
  return null
}

export async function readSafari(): Promise<BookmarkTree> {
  const file = join(homedir(), 'Library/Safari/Bookmarks.plist')
  let xml: string
  try {
    const { stdout } = await promisify(execFile)('/usr/bin/plutil', ['-convert', 'xml1', '-o', '-', file], {
      maxBuffer: 64 * 1024 * 1024
    })
    xml = stdout
  } catch {
    throw new ImportError(
      'macOS keeps Safari’s bookmarks private. In Safari, choose File → Export → Bookmarks…, then use “From a File…” here.'
    )
  }
  const root = parsePlistXml(xml) as Record<string, Plist>
  const top = Array.isArray(root.Children) ? root.Children : []
  const lists = top
    .filter((n) => n && typeof n === 'object' && !Array.isArray(n) && n.Title !== 'com.apple.ReadingList')
    .map(fromSafari)
    .filter((n): n is BookmarkNode => !!n)
  const bar = lists.find((n) => n.title === 'Favorites')
  return { bar: clean(bar && !isLink(bar) ? bar.children : []), all: clean(lists) }
}

// ---------- Exported .html file (any browser) ----------

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

/** The "Netscape bookmark file" format every browser exports. */
export function readHtmlFile(file: string): BookmarkTree {
  const html = readFileSync(file, 'utf8')
  const root: BookmarkNode[] = []
  const stack: BookmarkNode[][] = [root]
  let pendingFolder: { title: string; children: BookmarkNode[] } | null = null
  const re = /<(\/?)(dl|h3|a)\b([^>]*)>([^<]*)/gi
  for (let m = re.exec(html); m; m = re.exec(html)) {
    const [, closing, tag, attrs, after] = m
    const name = tag.toLowerCase()
    const current = stack[stack.length - 1]
    if (name === 'dl' && !closing) {
      if (pendingFolder) {
        current.push(pendingFolder)
        stack.push(pendingFolder.children)
        pendingFolder = null
      } else if (stack.length > 1 || root.length) stack.push(current)
    } else if (name === 'dl' && closing) {
      if (stack.length > 1) stack.pop()
    } else if (name === 'h3' && !closing) {
      pendingFolder = { title: decodeEntities(after), children: [] }
    } else if (name === 'a' && !closing) {
      const href = /href\s*=\s*"([^"]*)"/i.exec(attrs)?.[1] ?? ''
      current.push({ title: decodeEntities(after), url: decodeEntities(href) })
    }
  }
  const all = clean(root)
  const bar = all.find((n) => !isLink(n) && /^(bookmarks bar|bookmarks toolbar|favorites|favourites)$/i.test(n.title))
  return { bar: bar && !isLink(bar) ? bar.children : all.filter(isLink), all }
}

export function countLinks(nodes: BookmarkNode[]): number {
  return nodes.reduce((sum, n) => sum + (isLink(n) ? 1 : countLinks(n.children)), 0)
}
