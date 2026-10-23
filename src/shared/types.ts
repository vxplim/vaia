// Data shapes shared by the main process (the brain) and the UI.
// Everything in PersistedState is saved to disk; AppState adds live-only info.

export type ThemeMode = 'light' | 'dark' | 'auto'

export interface Theme {
  /** One color = solid, two or three = gradient. Hex strings like "#aabbcc". */
  colors: string[]
  mode: ThemeMode
}

export interface TabItem {
  kind: 'tab'
  id: string
  url: string
  title: string
  favicon?: string
  /** Set for pinned tabs and favorites: the URL they "belong" to. */
  pinnedUrl?: string
  createdAt: number
  lastViewedAt: number
}

export interface FolderItem {
  kind: 'folder'
  id: string
  name: string
  collapsed: boolean
  children: SidebarItem[]
}

export interface SplitItem {
  kind: 'split'
  id: string
  tabs: TabItem[]
  /** Fraction of the width each pane takes; adds up to 1. */
  sizes: number[]
  /** The pane you last clicked: the address bar and shortcuts act on it. */
  focusedId?: string
}

export type SidebarItem = TabItem | FolderItem | SplitItem

export interface Space {
  id: string
  name: string
  icon: string
  theme: Theme
  /** null = shared default profile; otherwise a separate cookie jar. */
  profileId: string | null
  pinned: SidebarItem[]
  today: SidebarItem[]
  /** The tab or split currently shown in this space. */
  activeId: string | null
}

export type SearchEngineId = 'google' | 'duckduckgo' | 'bing' | 'ecosia'
export type ArchiveAfter = '12h' | '24h' | '7d' | '30d' | 'never'

export interface Settings {
  searchEngine: SearchEngineId
  archiveAfter: ArchiveAfter
  adBlock: boolean
  sidebarVisible: boolean
  sidebarWidth: number
}

export interface Boost {
  enabled: boolean
  bgColor?: string
  textColor?: string
  linkColor?: string
  font?: string
  zaps: string[]
  css: string
  js: string
}

export interface PersistedState {
  version: 1
  spaces: Space[]
  activeSpaceId: string
  favorites: TabItem[]
  settings: Settings
  boosts: Record<string, Boost>
}

export interface TabRuntime {
  loading: boolean
  canGoBack: boolean
  canGoForward: boolean
}

export interface DownloadItem {
  id: string
  filename: string
  path: string
  url: string
  state: 'progressing' | 'completed' | 'cancelled' | 'interrupted'
  received: number
  total: number
  startedAt: number
}

export interface AppState extends PersistedState {
  runtime: Record<string, TabRuntime>
  downloads: DownloadItem[]
}

export interface HistoryEntry {
  url: string
  title: string
  favicon?: string
  visitedAt: number
  visitCount: number
}

export interface ArchivedTab {
  id: string
  url: string
  title: string
  favicon?: string
  archivedAt: number
  spaceId: string
}

/** Where a web page should appear inside the window, in window pixels. */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface Pane {
  tabId: string
  rect: Rect
}

/** Commands the brain asks the UI to perform (usually from keyboard shortcuts). */
export type UiCommand =
  | { type: 'focus-url' }
  | { type: 'command-bar'; mode?: 'new' | 'split' }
  | { type: 'edit-space'; id: string }
  | { type: 'open-panel'; panel: 'archive' }
  | { type: 'toast'; message: string }
