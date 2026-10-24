// The contract between the UI and the brain: every request the UI can make.
import type { Zone } from './tree'
import type {
  AppState,
  ArchivedTab,
  Boost,
  HistoryEntry,
  MediaList,
  Pane,
  PasswordInfo,
  PermissionDecision,
  PermissionKind,
  Rect,
  Settings,
  SplitPreset,
  Theme,
  Todo,
  UiCommand
} from './types'

export interface DropTarget {
  zone: Zone
  spaceId: string
  /** A folder to drop into (pinned area only); null = top level. */
  parentId: string | null
  index: number
}

export interface MenuItem {
  id?: string
  label?: string
  type?: 'separator'
  enabled?: boolean
  /** Shows a check mark next to the item. */
  checked?: boolean
  submenu?: MenuItem[]
}

export type Action =
  | { type: 'tab/new'; url?: string }
  | { type: 'tab/activate'; id: string }
  | { type: 'tab/close'; id: string }
  | { type: 'tab/navigate'; id: string; input: string }
  | { type: 'tab/back'; id: string }
  | { type: 'tab/forward'; id: string }
  | { type: 'tab/reload'; id: string }
  | { type: 'tab/stop'; id: string }
  | { type: 'tab/copyUrl'; id: string }
  | { type: 'tab/resetPinned'; id: string }
  | { type: 'tab/pin'; id: string }
  | { type: 'tab/unpin'; id: string }
  | { type: 'tab/favorite'; id: string }
  | { type: 'item/move'; id: string; to: DropTarget }
  | { type: 'item/delete'; id: string }
  /** A new folder at the end of a Space's pinned tabs (the current Space if none is given). */
  | { type: 'folder/new'; name?: string; spaceId?: string }
  | { type: 'folder/rename'; id: string; name: string }
  | { type: 'folder/toggle'; id: string }
  | { type: 'today/clear' }
  | { type: 'space/new'; name?: string; icon?: string }
  | { type: 'space/switch'; id: string }
  | { type: 'space/switchIndex'; index: number }
  | { type: 'space/switchRelative'; delta: number }
  | { type: 'space/update'; id: string; patch: { name?: string; icon?: string; theme?: Partial<Theme> } }
  | { type: 'space/setProfile'; id: string; separate: boolean }
  | { type: 'space/delete'; id: string }
  | { type: 'space/reorder'; id: string; index: number }
  | { type: 'tab/moveToSpace'; id: string; spaceId: string }
  | { type: 'split/add'; tabId?: string; url?: string; side?: 'left' | 'right' }
  | { type: 'split/detach'; tabId: string }
  | { type: 'split/dissolve'; id: string }
  | { type: 'split/resize'; id: string; sizes: number[] }
  | { type: 'split/resizeGrid'; id: string; col: number; row: number }
  | { type: 'split/even'; id: string }
  /** Apply a layout to a split, or turn a single tab into one (id = tab or split). */
  | { type: 'split/layout'; id: string; preset: SplitPreset }
  | { type: 'peek/close' }
  | { type: 'peek/expand' }
  | { type: 'little/new'; url?: string }
  | { type: 'little/toMain'; id: string }
  | { type: 'app/makeDefaultBrowser' }
  | { type: 'tab/duplicate'; id: string }
  | { type: 'find/query'; text: string; forward?: boolean; next?: boolean }
  | { type: 'find/stop' }
  | { type: 'download/open'; id: string }
  | { type: 'download/show'; id: string }
  | { type: 'download/cancel'; id: string }
  /** Move the downloaded file to the Trash and remove it from the list. */
  | { type: 'download/trash'; id: string }
  | { type: 'download/remove'; id: string }
  | { type: 'downloads/clear' }
  | { type: 'data/clear'; history?: boolean; cookies?: boolean; cache?: boolean; archive?: boolean }
  | { type: 'history/remove'; url: string }
  | { type: 'app/openSettings' }
  | { type: 'app/editSpace'; id: string }
  | { type: 'boost/update'; site: string; patch: Partial<Boost> }
  | { type: 'boost/delete'; site: string }
  | { type: 'boost/zapStart'; tabId: string }
  | { type: 'boost/zapStop'; tabId: string }
  | { type: 'boost/runJs'; tabId: string }
  | { type: 'tab/reopenClosed' }
  | { type: 'archive/restore'; id: string }
  | { type: 'archive/remove'; id: string }
  | { type: 'archive/clear' }
  | { type: 'settings/update'; patch: Partial<Settings> }
  | { type: 'today/tidy' }
  | { type: 'ai/setKey'; key: string }
  | { type: 'ai/clearKey' }
  | { type: 'todo/add'; text: string; spaceId: string | null; due?: string; linkTabId?: string; confirm?: boolean }
  | { type: 'todo/update'; id: string; patch: Partial<Pick<Todo, 'text' | 'done' | 'due' | 'spaceId' | 'link'>> }
  | { type: 'todo/delete'; id: string }
  | { type: 'todo/move'; id: string; beforeId: string | null }
  | { type: 'todo/open'; id: string }
  | { type: 'todo/linkActive'; id: string }
  | { type: 'todo/clearDone' }
  | { type: 'todo/popout' }
  | { type: 'permissions/set'; origin: string; kind: PermissionKind; decision: PermissionDecision | null }
  | { type: 'permissions/resetSite'; origin: string }
  | { type: 'permissions/resetAll' }
  | { type: 'extensions/setEnabled'; id: string; enabled: boolean }
  | { type: 'extensions/remove'; id: string }
  | { type: 'extensions/installById'; id: string }
  | { type: 'extensions/openStore' }
  | { type: 'private/new'; url?: string }
  | { type: 'tab/print'; id: string }
  | { type: 'bookmarks/import'; source: 'chrome' | 'safari' | 'file'; target: 'pinned' | 'favorites' }
  /** Open Google's sign-in page in a Space (in its own profile when it has one). */
  | { type: 'space/signInGoogle'; id: string }
  | { type: 'passwords/update'; id: string; username?: string; password?: string }
  | { type: 'passwords/delete'; id: string }
  /** The password itself, after Touch ID / your Mac password (null if cancelled). */
  | { type: 'passwords/reveal'; id: string }
  | { type: 'passwords/importCsv'; profile: string }
  | { type: 'passwords/trashCsv'; path: string }
  /** Save a Space's pinned and Today tabs as a bookmarks .html file (asks where). */
  | { type: 'space/exportBookmarks'; id: string }
  /** Files listed in Library → Media (only paths VAIA just listed are accepted). */
  | { type: 'media/open' | 'media/show' | 'media/copy' | 'media/trash'; path: string }
  | { type: 'media/openPrivacySettings' }

/** What the UI sees as window.vaia (provided by the preload bridge). */
export interface VaiaApi {
  platform: string
  getState(): Promise<AppState>
  onState(listener: (state: AppState) => void): () => void
  dispatch(action: Action): Promise<unknown>
  setPanes(panes: Pane[]): void
  /** Where the Peek card's page goes (null when there's no Peek). */
  setPeekRect(rect: Rect | null): void
  /** Take pictures of web pages (shown while an overlay covers them). */
  capture(tabIds: string[]): Promise<Record<string, string>>
  suggest(query: string): Promise<string[]>
  searchHistory(query: string): Promise<HistoryEntry[]>
  listArchive(query: string): Promise<ArchivedTab[]>
  listHistory(query: string): Promise<HistoryEntry[]>
  /** Show or hide the window's red/yellow/green buttons (hidden along with the sidebar). */
  setTrafficLights(visible: boolean): void
  /** Saved logins (no passwords). */
  listPasswords(): Promise<PasswordInfo[]>
  /** A small picture of a downloaded file (a thumbnail, or its Finder icon), as a data: URL. */
  downloadThumbnail(id: string): Promise<string | null>
  /** Downloaded pictures, videos and PDFs (and screenshots, if that setting is on), newest first. */
  listMedia(): Promise<MediaList>
  /** A Quick Look picture of a Media file, about `size` pixels wide, as a data: URL. */
  mediaThumbnail(path: string, size: number): Promise<string | null>
  /** Show a native right-click menu; resolves with the chosen item's id (or null). */
  popupMenu(items: MenuItem[]): Promise<string | null>
  onCommand(listener: (command: UiCommand) => void): () => void
}
