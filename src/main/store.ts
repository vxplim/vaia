// Holds all app data in memory, saves it to disk (debounced), and tells
// every open VAIA window when something changes.
import { app, type WebContents } from 'electron'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AppState, DownloadItem, PersistedState, Settings, Space, TabItem, TabRuntime } from '../shared/types'

export const newId = (): string => randomUUID()

function dataFile(name: string): string {
  return join(app.getPath('userData'), name)
}

export function readJson<T>(name: string, fallback: T): T {
  const file = dataFile(name)
  try {
    if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8')) as T
  } catch (err) {
    console.error(`[store] could not read ${name}, starting fresh`, err)
  }
  return fallback
}

/** Write to a temp file then rename, so a crash never leaves a half-written file. */
export function writeJson(name: string, data: unknown): void {
  const file = dataFile(name)
  mkdirSync(app.getPath('userData'), { recursive: true })
  writeFileSync(`${file}.tmp`, JSON.stringify(data))
  renameSync(`${file}.tmp`, file)
}

export const DEFAULT_SETTINGS: Settings = {
  searchEngine: 'google',
  archiveAfter: '12h',
  adBlock: false,
  sidebarVisible: true,
  sidebarWidth: 248,
  peekPinnedLinks: true,
  aiTidy: false,
  todoInSidebar: true,
  todoSectionCollapsed: false,
  todoWindowOnTop: false
}

export function newSpace(name: string, icon: string, colors: string[]): Space {
  return {
    id: newId(),
    name,
    icon,
    theme: { colors, mode: 'auto' },
    profileId: null,
    pinned: [],
    today: [],
    activeId: null
  }
}

function defaultState(): PersistedState {
  const space = newSpace('Personal', '🌿', ['#d9e4d8', '#ece3d3'])
  return {
    version: 1,
    spaces: [space],
    activeSpaceId: space.id,
    favorites: [],
    settings: { ...DEFAULT_SETTINGS },
    boosts: {},
    todos: []
  }
}

/** Fill in anything missing (e.g. data saved by an older version of VAIA). */
function normalize(raw: Partial<PersistedState>): PersistedState {
  const base = defaultState()
  const state: PersistedState = {
    ...base,
    ...raw,
    settings: { ...DEFAULT_SETTINGS, ...(raw.settings ?? {}) },
    boosts: raw.boosts ?? {},
    favorites: raw.favorites ?? [],
    todos: raw.todos ?? []
  }
  if (!Array.isArray(state.spaces) || state.spaces.length === 0) state.spaces = base.spaces
  state.spaces = state.spaces.map((s) => ({ ...newSpace(s.name, s.icon, s.theme?.colors ?? ['#e5e5e5']), ...s }))
  if (!state.spaces.some((s) => s.id === state.activeSpaceId)) state.activeSpaceId = state.spaces[0].id
  return state
}

const STATE_FILE = 'vaia-state.json'

export class Store {
  state: PersistedState
  runtime: Record<string, TabRuntime> = {}
  downloads: DownloadItem[] = []
  peek: TabItem | null = null
  littles: Record<string, TabItem> = {}
  aiKeySet = false
  private subscribers = new Set<WebContents>()
  private saveTimer: NodeJS.Timeout | null = null
  private broadcastTimer: NodeJS.Timeout | null = null

  constructor() {
    this.state = normalize(readJson<Partial<PersistedState>>(STATE_FILE, {}))
  }

  snapshot(): AppState {
    return { ...this.state, runtime: this.runtime, downloads: this.downloads, peek: this.peek, littles: this.littles, aiKeySet: this.aiKeySet }
  }

  subscribe(wc: WebContents): void {
    this.subscribers.add(wc)
    wc.once('destroyed', () => this.subscribers.delete(wc))
  }

  /** Call after every change: schedules a save and a UI update. */
  changed(persist = true): void {
    if (persist && !this.saveTimer) {
      this.saveTimer = setTimeout(() => this.flush(), 400)
    }
    if (!this.broadcastTimer) {
      this.broadcastTimer = setTimeout(() => {
        this.broadcastTimer = null
        const snap = this.snapshot()
        for (const wc of this.subscribers) if (!wc.isDestroyed()) wc.send('state:changed', snap)
      }, 8)
    }
  }

  flush(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = null
    try {
      writeJson(STATE_FILE, this.state)
    } catch (err) {
      console.error('[store] save failed', err)
    }
  }
}
