// The Archive: Today tabs that were closed, cleared, or tidied away automatically.
// Also remembers the most recently closed tabs for ⌘⇧T. Saved to archive.json.
import type { ArchivedTab, TabItem } from '../shared/types'
import { readJson, writeJson } from './store'

const FILE = 'archive.json'
const MAX_ARCHIVED = 2000
const MAX_RECENTLY_CLOSED = 50

interface ArchiveFile {
  archived: ArchivedTab[]
  recentlyClosed: ArchivedTab[]
}

export class Archive {
  private data: ArchiveFile
  private saveTimer: NodeJS.Timeout | null = null

  constructor() {
    const raw = readJson<Partial<ArchiveFile>>(FILE, {})
    this.data = { archived: raw.archived ?? [], recentlyClosed: raw.recentlyClosed ?? [] }
  }

  /** Put a tab in the Archive (newest first). Blank tabs aren't worth keeping. */
  add(tab: TabItem, spaceId: string, closedByUser: boolean): void {
    if (!tab.url) return
    const entry: ArchivedTab = {
      id: tab.id,
      url: tab.url,
      title: tab.title,
      favicon: tab.favicon,
      archivedAt: Date.now(),
      spaceId
    }
    this.data.archived.unshift(entry)
    this.data.archived.length = Math.min(this.data.archived.length, MAX_ARCHIVED)
    if (closedByUser) {
      this.data.recentlyClosed.unshift(entry)
      this.data.recentlyClosed.length = Math.min(this.data.recentlyClosed.length, MAX_RECENTLY_CLOSED)
    }
    this.scheduleSave()
  }

  /** Take the most recently closed tab off the stack (for ⌘⇧T). */
  popRecentlyClosed(): ArchivedTab | null {
    const entry = this.data.recentlyClosed.shift() ?? null
    if (entry) this.remove(entry.id)
    return entry
  }

  list(query = ''): ArchivedTab[] {
    const q = query.trim().toLowerCase()
    if (!q) return this.data.archived
    return this.data.archived.filter((a) => `${a.title} ${a.url}`.toLowerCase().includes(q))
  }

  get(id: string): ArchivedTab | null {
    return this.data.archived.find((a) => a.id === id) ?? null
  }

  remove(id: string): void {
    this.data.archived = this.data.archived.filter((a) => a.id !== id)
    this.data.recentlyClosed = this.data.recentlyClosed.filter((a) => a.id !== id)
    this.scheduleSave()
  }

  clear(): void {
    this.data = { archived: [], recentlyClosed: [] }
    this.flush()
  }

  private scheduleSave(): void {
    if (!this.saveTimer) this.saveTimer = setTimeout(() => this.flush(), 1000)
  }

  flush(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = null
    try {
      writeJson(FILE, this.data)
    } catch (err) {
      console.error('[archive] save failed', err)
    }
  }
}

const HOUR = 3_600_000

export const ARCHIVE_AFTER_MS: Record<string, number | null> = {
  '12h': 12 * HOUR,
  '24h': 24 * HOUR,
  '7d': 7 * 24 * HOUR,
  '30d': 30 * 24 * HOUR,
  never: null
}
