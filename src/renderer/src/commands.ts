// App commands you can run from the Command Bar (⌘T), e.g. "Toggle Sidebar".
import { locate } from '../../shared/tree'
import type { AppState } from '../../shared/types'
import { sameUrl } from '../../shared/url'
import { dispatch } from './state'

export interface CommandContext {
  state: AppState
  activeTabId: string | null
  /** Things only the UI can do, like opening a panel. */
  ui: {
    editSpace: (spaceId: string) => void
    openPanel: (panel: 'archive') => void
    /** Reopen the Command Bar to pick what goes in a new Split View pane. */
    openSplitPicker: () => void
  }
}

export interface Command {
  id: string
  title: string
  shortcut?: string
  /** Extra words that should also match this command. */
  keywords?: string
  enabled?: (ctx: CommandContext) => boolean
  run: (ctx: CommandContext) => void
}

const hasTab = (ctx: CommandContext) => !!ctx.activeTabId
const zoneOf = (ctx: CommandContext) => (ctx.activeTabId ? locate(ctx.state, ctx.activeTabId)?.zone : undefined)
const activeTab = (ctx: CommandContext) => {
  const loc = ctx.activeTabId ? locate(ctx.state, ctx.activeTabId) : null
  return loc?.item.kind === 'tab' ? loc.item : null
}

export const COMMANDS: Command[] = [
  {
    id: 'copy-url',
    title: 'Copy URL',
    shortcut: '⇧⌘C',
    keywords: 'link address clipboard share',
    enabled: hasTab,
    run: (ctx) => dispatch({ type: 'tab/copyUrl', id: ctx.activeTabId! })
  },
  {
    id: 'toggle-sidebar',
    title: 'Toggle Sidebar',
    shortcut: '⌘S',
    keywords: 'hide show sidebar',
    run: (ctx) => dispatch({ type: 'settings/update', patch: { sidebarVisible: !ctx.state.settings.sidebarVisible } })
  },
  {
    id: 'reload',
    title: 'Reload Page',
    shortcut: '⌘R',
    keywords: 'refresh',
    enabled: hasTab,
    run: (ctx) => dispatch({ type: 'tab/reload', id: ctx.activeTabId! })
  },
  {
    id: 'back',
    title: 'Go Back',
    shortcut: '⌘[',
    enabled: (ctx) => !!ctx.activeTabId && !!ctx.state.runtime[ctx.activeTabId]?.canGoBack,
    run: (ctx) => dispatch({ type: 'tab/back', id: ctx.activeTabId! })
  },
  {
    id: 'forward',
    title: 'Go Forward',
    shortcut: '⌘]',
    enabled: (ctx) => !!ctx.activeTabId && !!ctx.state.runtime[ctx.activeTabId]?.canGoForward,
    run: (ctx) => dispatch({ type: 'tab/forward', id: ctx.activeTabId! })
  },
  {
    id: 'pin-tab',
    title: 'Pin Tab',
    keywords: 'keep',
    enabled: (ctx) => zoneOf(ctx) === 'today',
    run: (ctx) => dispatch({ type: 'tab/pin', id: ctx.activeTabId! })
  },
  {
    id: 'unpin-tab',
    title: 'Unpin Tab',
    enabled: (ctx) => zoneOf(ctx) === 'pinned',
    run: (ctx) => dispatch({ type: 'tab/unpin', id: ctx.activeTabId! })
  },
  {
    id: 'add-favorite',
    title: 'Add to Favorites',
    keywords: 'favourite star',
    enabled: (ctx) => !!zoneOf(ctx) && zoneOf(ctx) !== 'favorites',
    run: (ctx) => dispatch({ type: 'tab/favorite', id: ctx.activeTabId! })
  },
  {
    id: 'remove-favorite',
    title: 'Remove from Favorites',
    keywords: 'favourite',
    enabled: (ctx) => zoneOf(ctx) === 'favorites',
    run: (ctx) => dispatch({ type: 'tab/unpin', id: ctx.activeTabId! })
  },
  {
    id: 'reset-pinned',
    title: 'Return to Pinned Page',
    keywords: 'reset home original',
    enabled: (ctx) => {
      const tab = activeTab(ctx)
      return !!tab?.pinnedUrl && !sameUrl(tab.url, tab.pinnedUrl)
    },
    run: (ctx) => dispatch({ type: 'tab/resetPinned', id: ctx.activeTabId! })
  },
  {
    id: 'new-folder',
    title: 'New Folder',
    keywords: 'group pinned',
    run: () => dispatch({ type: 'folder/new' })
  },
  {
    id: 'clear-today',
    title: 'Clear Today Tabs',
    keywords: 'close all tidy',
    run: () => dispatch({ type: 'today/clear' })
  },
  {
    id: 'split-view',
    title: 'Add Split View Pane',
    shortcut: '⌃⇧=',
    keywords: 'side by side split screen',
    enabled: hasTab,
    run: (ctx) => ctx.ui.openSplitPicker()
  },
  {
    id: 'little-window',
    title: 'New Little Window',
    shortcut: '⌥⌘N',
    keywords: 'mini small quick popup',
    run: () => dispatch({ type: 'little/new' })
  },
  {
    id: 'default-browser',
    title: 'Make VAIA Your Default Browser',
    keywords: 'default',
    run: () => dispatch({ type: 'app/makeDefaultBrowser' })
  },
  {
    id: 'reopen-closed',
    title: 'Reopen Closed Tab',
    shortcut: '⇧⌘T',
    keywords: 'undo restore',
    run: () => dispatch({ type: 'tab/reopenClosed' })
  },
  {
    id: 'open-archive',
    title: 'Open Archive',
    keywords: 'archived closed old tabs',
    run: (ctx) => ctx.ui.openPanel('archive')
  },
  {
    id: 'close-tab',
    title: 'Close Tab',
    shortcut: '⌘W',
    enabled: hasTab,
    run: (ctx) => dispatch({ type: 'tab/close', id: ctx.activeTabId! })
  }
]

const SPACE_COMMANDS: Command[] = [
  {
    id: 'new-space',
    title: 'New Space',
    keywords: 'create workspace',
    run: async (ctx) => ctx.ui.editSpace((await dispatch({ type: 'space/new' })) as string)
  },
  {
    id: 'edit-space',
    title: 'Edit Space Theme…',
    keywords: 'color colour rename emoji icon appearance dark light profile',
    run: (ctx) => ctx.ui.editSpace(ctx.state.activeSpaceId)
  }
]

/** "Switch to Space: Work", "Move Tab to Space: Work" for every other Space. */
function perSpaceCommands(ctx: CommandContext): Command[] {
  return ctx.state.spaces
    .filter((s) => s.id !== ctx.state.activeSpaceId)
    .flatMap((s): Command[] => [
      {
        id: `switch-space-${s.id}`,
        title: `Switch to Space: ${s.icon} ${s.name}`,
        keywords: 'go',
        run: () => dispatch({ type: 'space/switch', id: s.id })
      },
      {
        id: `move-space-${s.id}`,
        title: `Move Tab to Space: ${s.icon} ${s.name}`,
        keywords: 'send',
        enabled: hasTab,
        run: (c) => dispatch({ type: 'tab/moveToSpace', id: c.activeTabId!, spaceId: s.id })
      }
    ])
}

/** Commands whose title or keywords contain every typed word. */
export function matchCommands(query: string, ctx: CommandContext): Command[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  return [...COMMANDS, ...SPACE_COMMANDS, ...perSpaceCommands(ctx)].filter((c) => {
    if (c.enabled && !c.enabled(ctx)) return false
    const hay = `${c.title} ${c.keywords ?? ''}`.toLowerCase()
    return words.every((w) => hay.includes(w))
  })
}
