// The contract between the UI and the brain: every request the UI can make.
import type { Zone } from './tree'
import type { AppState, ArchivedTab, HistoryEntry, Pane, Settings, Theme, UiCommand } from './types'

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
  | { type: 'folder/new'; name?: string }
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
  | { type: 'tab/reopenClosed' }
  | { type: 'archive/restore'; id: string }
  | { type: 'archive/remove'; id: string }
  | { type: 'archive/clear' }
  | { type: 'settings/update'; patch: Partial<Settings> }

/** What the UI sees as window.vaia (provided by the preload bridge). */
export interface VaiaApi {
  platform: string
  getState(): Promise<AppState>
  onState(listener: (state: AppState) => void): () => void
  dispatch(action: Action): Promise<unknown>
  setPanes(panes: Pane[]): void
  /** Take pictures of web pages (shown while an overlay covers them). */
  capture(tabIds: string[]): Promise<Record<string, string>>
  suggest(query: string): Promise<string[]>
  searchHistory(query: string): Promise<HistoryEntry[]>
  listArchive(query: string): Promise<ArchivedTab[]>
  /** Show a native right-click menu; resolves with the chosen item's id (or null). */
  popupMenu(items: MenuItem[]): Promise<string | null>
  onCommand(listener: (command: UiCommand) => void): () => void
}
