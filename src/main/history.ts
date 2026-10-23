// Browsing history: one entry per web address, with its last visit time and
// how often you've been there. Saved to history.json.
import type { HistoryEntry } from '../shared/types'
import { readJson, writeJson } from './store'

const FILE = 'history.json'
const MAX_ENTRIES = 10000

export class History {
  private entries = new Map<string, HistoryEntry>()
  private saveTimer: NodeJS.Timeout | null = null

  constructor() {
    for (const e of readJson<HistoryEntry[]>(FILE, [])) this.entries.set(e.url, e)
  }

  visit(url: string, title: string, favicon?: string): void {
    if (!/^https?:/.test(url)) return
    const existing = this.entries.get(url)
    // Re-insert so the Map stays ordered from oldest to newest visit.
    this.entries.delete(url)
    this.entries.set(url, {
      url,
      title: title || existing?.title || url,
      favicon: favicon ?? existing?.favicon,
      visitedAt: Date.now(),
      visitCount: (existing?.visitCount ?? 0) + 1
    })
    if (this.entries.size > MAX_ENTRIES) this.entries.delete(this.entries.keys().next().value!)
    this.scheduleSave()
  }

  update(url: string, patch: Partial<Pick<HistoryEntry, 'title' | 'favicon'>>): void {
    const entry = this.entries.get(url)
    if (!entry) return
    Object.assign(entry, patch)
    this.scheduleSave()
  }

  /** Best matches for the command bar: every word must appear in the title or URL. */
  search(query: string, limit = 6): HistoryEntry[] {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean)
    if (!words.length) return []
    const now = Date.now()
    const scored: { e: HistoryEntry; score: number }[] = []
    for (const e of this.entries.values()) {
      const hay = `${e.title} ${e.url}`.toLowerCase()
      if (!words.every((w) => hay.includes(w))) continue
      const host = e.url.replace(/^https?:\/\/(www\.)?/, '')
      const ageDays = (now - e.visitedAt) / 86_400_000
      let score = Math.log2(1 + e.visitCount) - ageDays / 30
      if (host.startsWith(words[0])) score += 3
      scored.push({ e, score })
    }
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => s.e)
  }

  /** Most recent first, for the History page. */
  list(query = '', limit = 500): HistoryEntry[] {
    const q = query.toLowerCase()
    const out: HistoryEntry[] = []
    const all = [...this.entries.values()]
    for (let i = all.length - 1; i >= 0 && out.length < limit; i--) {
      const e = all[i]
      if (!q || `${e.title} ${e.url}`.toLowerCase().includes(q)) out.push(e)
    }
    return out
  }

  remove(url: string): void {
    this.entries.delete(url)
    this.scheduleSave()
  }

  clear(): void {
    this.entries.clear()
    this.flush()
  }

  private scheduleSave(): void {
    if (!this.saveTimer) this.saveTimer = setTimeout(() => this.flush(), 2000)
  }

  flush(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = null
    try {
      writeJson(FILE, [...this.entries.values()])
    } catch (err) {
      console.error('[history] save failed', err)
    }
  }
}
