// Notes and Easels, saved on this Mac in docs.json. Their tabs point at
// vaia:note/<id> or vaia:easel/<id>; the interface draws them (no web page).
import type { Doc, DocInfo, DocKind, EaselItem } from '../shared/types'
import { newId, readJson, writeJson } from './store'

const FILE = 'docs.json'

/** The plain text of a note's HTML (for search and its title). */
export function htmlText(html: string): string {
  return html
    .replace(/<(br|\/?p|\/?div|\/?h[1-6]|\/?li|\/?ul|\/?ol|\/?blockquote)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
}

export class Docs {
  private docs: Record<string, Doc> = readJson<Record<string, Doc>>(FILE, {})
  private saveTimer: NodeJS.Timeout | null = null

  constructor(private onChange: (doc: Doc) => void) {}

  list(): DocInfo[] {
    return Object.values(this.docs)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map(({ id, kind, title, updatedAt }) => ({ id, kind, title, updatedAt }))
  }

  get(id: string): Doc | null {
    return this.docs[id] ?? null
  }

  create(kind: DocKind): Doc {
    const doc: Doc = {
      id: newId(),
      kind,
      title: kind === 'note' ? 'Untitled Note' : 'Untitled Easel',
      ...(kind === 'note' ? { html: '' } : { items: [] }),
      updatedAt: Date.now()
    }
    this.docs[doc.id] = doc
    this.scheduleSave()
    return doc
  }

  save(id: string, patch: Partial<Pick<Doc, 'title' | 'html' | 'items'>>): void {
    const doc = this.docs[id]
    if (!doc) return
    if (typeof patch.html === 'string' && doc.kind === 'note') {
      doc.html = patch.html
      // A note is named after its first line.
      const first = htmlText(patch.html).split('\n').map((l) => l.trim()).find(Boolean)
      doc.title = first ? first.slice(0, 80) : 'Untitled Note'
    }
    if (Array.isArray(patch.items) && doc.kind === 'easel') doc.items = patch.items.slice(0, 500)
    if (typeof patch.title === 'string' && patch.title.trim()) doc.title = patch.title.trim().slice(0, 80)
    doc.updatedAt = Date.now()
    this.scheduleSave()
    this.onChange(doc)
  }

  addEaselItem(id: string, item: Omit<EaselItem, 'id' | 'x' | 'y'>): boolean {
    const doc = this.docs[id]
    if (!doc || doc.kind !== 'easel') return false
    const items = doc.items ?? []
    // New things land a little below and to the right of the last one.
    const last = items[items.length - 1]
    const x = last ? last.x + 32 : 40
    const y = last ? last.y + 32 : 40
    this.save(id, { items: [...items, { ...item, id: newId(), x, y }] })
    return true
  }

  search(query: string): { id: string; kind: DocKind; title: string; snippet: string }[] {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const out: { id: string; kind: DocKind; title: string; snippet: string }[] = []
    for (const doc of Object.values(this.docs)) {
      const text = doc.kind === 'note' ? htmlText(doc.html ?? '').replace(/\s+/g, ' ') : (doc.items ?? []).map((i) => i.text ?? i.url ?? '').join(' ')
      const at = text.toLowerCase().indexOf(q)
      if (at < 0 && !doc.title.toLowerCase().includes(q)) continue
      const snippet = at < 0 ? text.slice(0, 80) : `${at > 30 ? '…' : ''}${text.slice(Math.max(0, at - 30), at + 60)}`
      out.push({ id: doc.id, kind: doc.kind, title: doc.title, snippet })
    }
    return out.slice(0, 8)
  }

  private scheduleSave(): void {
    if (this.saveTimer) return
    this.saveTimer = setTimeout(() => this.flush(), 500)
  }

  flush(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = null
    try {
      writeJson(FILE, this.docs)
    } catch (err) {
      console.error('[docs] save failed', err)
    }
  }
}
