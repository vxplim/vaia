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
  /** Your own name for the tab ("Rename…"). Wins over everything and survives navigation. */
  customName?: string
  /** A page in a private window: nothing about it is saved. */
  private?: boolean
  /** A Live Folder item you haven't opened yet. */
  unread?: boolean
  createdAt: number
  lastViewedAt: number
}

export interface FolderItem {
  kind: 'folder'
  id: string
  name: string
  collapsed: boolean
  children: SidebarItem[]
  /** A Live Folder: filled from an RSS/Atom feed. */
  feed?: LiveFeed
}

export interface LiveFeed {
  url: string
  lastChecked?: number
  /** Why the last refresh failed, if it did. */
  error?: string
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
/** Background tabs not viewed for this long are put to sleep (unloaded) to save memory. */
export type SleepAfter = '30m' | '1h' | '4h' | 'never'
export type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

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
  /** Show Google's sign-in pages a Firefox browser name, so Google allows signing in. */
  googleSignInCompat: boolean
  /** The Library section you looked at last. */
  librarySection: LibrarySection
  /** Library → Media also shows pictures from the Mac's screenshots folder. */
  mediaScreenshots: boolean
  sleepAfter: SleepAfter
  /** Where the Mini Player sits in the page area. */
  miniPlayerCorner: Corner
  /** A minimal sidebar: no Space name, no back/forward/reload, no extension or Boost buttons. */
  compactMode: boolean
  sidebarSide: 'left' | 'right'
}

/** Air Traffic Control: "links matching … open in …" (for links from other apps and Little windows). */
export interface AtcRule {
  id: string
  /** A domain (example.com, also matches its subdomains) or any text in the address. */
  match: string
  /** A Space id, or "little" for a Little window. */
  target: string
}

/** A site shown in the narrow panel next to the page. */
export interface SidePanel {
  tab: TabItem
  width: number
  open: boolean
}

export type DocKind = 'note' | 'easel'

/** Something on an Easel. Positions and sizes are in canvas pixels. */
export interface EaselItem {
  id: string
  kind: 'image' | 'text' | 'link'
  x: number
  y: number
  w: number
  h: number
  /** Image address (https:, or data: for dropped files and captures). */
  src?: string
  text?: string
  url?: string
  /** The page an image or capture came from. */
  sourceUrl?: string
}

/** A note or an Easel (saved in docs.json). */
export interface Doc {
  id: string
  kind: DocKind
  title: string
  /** A note's content (simple, cleaned HTML). */
  html?: string
  items?: EaselItem[]
  updatedAt: number
}

export interface DocInfo {
  id: string
  kind: DocKind
  title: string
  updatedAt: number
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
  airTraffic: AtcRule[]
  sidePanel: SidePanel | null
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

/** A saved login as the interface sees it (the password itself stays in the brain). */
export interface PasswordInfo {
  id: string
  /** "default" = the shared profile, otherwise a Space's profile id. */
  profile: string
  origin: string
  username: string
  updatedAt: number
}

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
  /** The page is making sound right now. */
  audible?: boolean
  /** You muted this tab. */
  muted?: boolean
}

/** The small floating player for a tab you left while it was playing (or in a call). */
export interface MiniPlayer {
  tabId: string
  /** The page has a video (offers picture in picture). */
  video: boolean
  /** A video call (Meet, Zoom): no play/pause, just sound and "back to call". */
  call: boolean
  playing: boolean
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
  mini: MiniPlayer | null
  /** Notes and Easels (titles only). */
  docs: DocInfo[]
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

/** The sections of the Library (the bottom-left button, ⇧⌘L). */
export type LibrarySection = 'archive' | 'downloads' | 'media' | 'spaces' | 'boosts' | 'todo'

/** A picture, video or PDF shown in Library → Media. */
export interface MediaItem {
  path: string
  name: string
  kind: 'image' | 'video' | 'pdf'
  size: number
  /** When it was downloaded (or, for screenshots, taken). */
  time: number
  source: 'download' | 'screenshot' | 'capture'
}

export interface MediaList {
  items: MediaItem[]
  /** Screenshots were asked for but macOS didn't let VAIA see that folder. */
  screenshotsBlocked?: boolean
  screenshotsFolder?: string
}

/** Commands the brain asks the UI to perform (usually from keyboard shortcuts). */
export type UiCommand =
  | { type: 'focus-url' }
  | { type: 'command-bar'; mode?: 'new' | 'split' }
  | { type: 'edit-space'; id: string; setup?: boolean }
  | { type: 'open-library'; section?: LibrarySection }
  | { type: 'open-panel'; panel: Panel }
  | { type: 'find' }
  | { type: 'find-next'; forward: boolean }
  | { type: 'find-result'; matches: number; active: number }
  | { type: 'toggle-sidebar' }
  | { type: 'boost' }
  | { type: 'zap-ended' }
  /** Ctrl+Tab was pressed in a web page: open (or advance) the tab switcher. */
  | { type: 'tab-switcher'; back: boolean }
  /** Ctrl was let go in a web page: pick the highlighted tab. */
  | { type: 'tab-switcher-commit' }
  /** ⇧⌘2: capture part of the page. */
  | { type: 'capture' }
  /** A piece of Claude's answer for Ask on Page (done = finished, error = what went wrong). */
  | { type: 'ask-update'; askId: string; text: string; done: boolean; error?: string }
