// Data shapes shared by the main process (the brain) and the UI.
// Everything in PersistedState is saved to disk; AppState adds live-only info.

export type ThemeMode = 'light' | 'dark' | 'auto'

export interface Theme {
  /** One color = solid, two or three = gradient. Hex strings like "#aabbcc". */
  colors: string[]
  mode: ThemeMode
  /** 0 = Whisper (barely-there tint) … 1 = Soft (gentle pastel). Missing = 0.6. */
  intensity?: number
  /** -1 = warmer … 0 = as picked … 1 = cooler. Missing = 0. */
  tone?: number
  /** false = use only the first color. Missing = on when there are 2+ colors. */
  gradient?: boolean
}

export interface TabItem {
  kind: 'tab'
  id: string
  url: string
  title: string
  favicon?: string
  /** Set for pinned tabs and favorites: the URL they "belong" to. */
  pinnedUrl?: string
  /** A shorter name shown instead of the page title (set by AI Tidy). */
  name?: string
  /** A page in a private window: nothing about it is saved. */
  private?: boolean
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
  /** Side by side (default), or a 2×2 grid when there are exactly four panes. */
  layout?: 'columns' | 'grid'
  /** For the grid: left column's share of the width, top row's share of the height. */
  grid?: { col: number; row: number }
}

/** Ready-made Split View layouts. */
export type SplitPreset = '50-50' | '70-30' | '30-70' | 'three' | 'grid'

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
  /** Links from pinned tabs/favorites to other sites open in a Peek card. */
  peekPinnedLinks: boolean
  /** Tidy asks Claude for topic folders (needs an API key). */
  aiTidy: boolean
  /** Show this Space's to-dos in the sidebar under Pinned. */
  todoInSidebar: boolean
  todoSectionCollapsed: boolean
  /** The popped-out to-do window floats above other apps. */
  todoWindowOnTop: boolean
  /** Ids of installed extensions that are switched off. */
  disabledExtensions: string[]
}

export interface Todo {
  id: string
  text: string
  done: boolean
  /** When it was checked off (done items are deleted 7 days later). */
  doneAt?: number
  /** "YYYY-MM-DD" (a calendar day, no time). */
  due?: string
  /** A page this to-do is about; clicking the to-do opens it. */
  link?: { url: string; title: string }
  /** The Space it belongs to, or null for "Everywhere". */
  spaceId: string | null
  createdAt: number
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
  /** One shared list, in the order you arranged it. */
  todos: Todo[]
}

export type PermissionKind =
  | 'camera'
  | 'microphone'
  | 'location'
  | 'notifications'
  | 'clipboard'
  | 'midi'
  | 'idle'
  | 'windows'
  | 'open-apps'
export type PermissionDecision = 'allow' | 'block'
/** Remembered permission answers, by site (e.g. "https://meet.google.com"). */
export type SitePermissions = Record<string, Partial<Record<PermissionKind, PermissionDecision>>>

export interface ExtensionInfo {
  id: string
  name: string
  version: string
  enabled: boolean
  /** A data: URL of the extension's icon, if it has one. */
  icon?: string
}

export interface TabRuntime {
  loading: boolean
  canGoBack: boolean
  canGoForward: boolean
  /** The page's process crashed; the tab shows a "page crashed" card with Reload. */
  crashed?: boolean
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
  /** The page open in the Peek card, if any. */
  peek: TabItem | null
  /** Pages open in Little windows, by tab id. */
  littles: Record<string, TabItem>
  /** Whether a Claude API key is saved (the key itself never leaves the brain). */
  aiKeySet: boolean
  sitePermissions: SitePermissions
  extensions: ExtensionInfo[]
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

/** Floating panels in the main window. */
export type Panel = 'archive' | 'history' | 'downloads' | 'todo'

/** Commands the brain asks the UI to perform (usually from keyboard shortcuts). */
export type UiCommand =
  | { type: 'focus-url' }
  | { type: 'command-bar'; mode?: 'new' | 'split' }
  | { type: 'edit-space'; id: string }
  | { type: 'open-panel'; panel: Panel }
  | { type: 'find' }
  | { type: 'find-next'; forward: boolean }
  | { type: 'find-result'; matches: number; active: number }
  | { type: 'toggle-sidebar' }
  | { type: 'boost' }
  | { type: 'zap-ended' }
