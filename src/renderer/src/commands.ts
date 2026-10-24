// App commands you can run from the Command Bar (⌘T), e.g. "Toggle Sidebar".
import { locate } from '../../shared/tree'
import type { AppState, LibrarySection, Panel } from '../../shared/types'
import { sameUrl } from '../../shared/url'
import { SPLIT_LAYOUTS } from './splitLayouts'
import { dispatch } from './state'

export interface CommandContext {
  state: AppState
  activeTabId: string | null
  /** Things only the UI can do, like opening a panel. */
  ui: {
    editSpace: (spaceId: string, setup?: boolean) => void
    openPanel: (panel: Panel) => void
    /** The Library, at a section (or the one you looked at last). */
    openLibrary: (section?: LibrarySection) => void
    /** Reopen the Command Bar to pick what goes in a new Split View pane. */
    openSplitPicker: () => void
    toggleSidebar: () => void
    find: () => void
    boost: () => void
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
    run: (ctx) => ctx.ui.toggleSidebar()
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
    id: 'todo',
    title: 'Open To-do List',
    shortcut: '⇧⌘K',
    keywords: 'tasks todo to-do checklist reminders',
    run: (ctx) => ctx.ui.openPanel('todo')
  },
  {
    id: 'todo-popout',
    title: 'Pop Out To-do List',
    keywords: 'tasks todo to-do window sticky float',
    run: () => dispatch({ type: 'todo/popout' })
  },
  {
    id: 'tidy',
    title: 'Tidy Today Tabs',
    keywords: 'organize group folders duplicates clean sort',
    run: () => dispatch({ type: 'today/tidy' })
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
    id: 'private-window',
    title: 'New Private Window',
    shortcut: '⇧⌘N',
    keywords: 'incognito secret',
    run: () => dispatch({ type: 'private/new' })
  },
  {
    id: 'print',
    title: 'Print Page…',
    shortcut: '⌘P',
    keywords: 'pdf save paper',
    enabled: hasTab,
    run: (ctx) => dispatch({ type: 'tab/print', id: ctx.activeTabId! })
  },
  {
    id: 'extensions',
    title: 'Manage Extensions',
    keywords: 'add-ons plugins chrome web store',
    run: () => dispatch({ type: 'app/openSettings' })
  },
  {
    id: 'extensions-store',
    title: 'Get Extensions from the Chrome Web Store',
    keywords: 'add-ons plugins install',
    run: () => dispatch({ type: 'extensions/openStore' })
  },
  {
    id: 'import',
    title: 'Import Bookmarks…',
    keywords: 'chrome safari favorites migrate',
    run: () => dispatch({ type: 'app/openSettings' })
  },
  {
    id: 'default-browser',
    title: 'Make VAIA Your Default Browser',
    keywords: 'default',
    run: () => dispatch({ type: 'app/makeDefaultBrowser' })
  },
  {
    id: 'settings',
    title: 'Settings',
    shortcut: '⌘,',
    keywords: 'preferences options search engine',
    run: () => dispatch({ type: 'app/openSettings' })
  },
  {
    id: 'history',
    title: 'Show History',
    shortcut: '⌘Y',
    keywords: 'visited past',
    run: (ctx) => ctx.ui.openPanel('history')
  },
  {
    id: 'library',
    title: 'Open Library',
    shortcut: '⇧⌘L',
    keywords: 'archive downloads media spaces boosts to-do collection',
    run: (ctx) => ctx.ui.openLibrary()
  },
  {
    id: 'downloads',
    title: 'Show Downloads',
    shortcut: '⇧⌘J',
    keywords: 'files library',
    run: (ctx) => ctx.ui.openLibrary('downloads')
  },
  {
    id: 'media',
    title: 'Show Media',
    keywords: 'pictures photos images videos pdf screenshots library',
    run: (ctx) => ctx.ui.openLibrary('media')
  },
  {
    id: 'manage-boosts',
    title: 'Manage Boosts',
    keywords: 'customized sites library',
    run: (ctx) => ctx.ui.openLibrary('boosts')
  },
  {
    id: 'find',
    title: 'Find in Page',
    shortcut: '⌘F',
    keywords: 'search text',
    enabled: hasTab,
    run: (ctx) => ctx.ui.find()
  },
  {
    id: 'boost',
    title: 'Boost This Site',
    keywords: 'customize colors font zap css javascript style theme',
    enabled: hasTab,
    run: (ctx) => ctx.ui.boost()
  },
  {
    id: 'zap',
    title: 'Zap Elements on This Page',
    keywords: 'hide remove boost',
    enabled: hasTab,
    run: (ctx) => {
      ctx.ui.boost()
      dispatch({ type: 'boost/zapStart', tabId: ctx.activeTabId! })
    }
  },
  {
    id: 'duplicate',
    title: 'Duplicate Tab',
    keywords: 'copy clone',
    enabled: hasTab,
    run: (ctx) => dispatch({ type: 'tab/duplicate', id: ctx.activeTabId! })
  },
  {
    id: 'adblock',
    title: 'Toggle Ad Blocker',
    keywords: 'ads trackers block',
    run: (ctx) => dispatch({ type: 'settings/update', patch: { adBlock: !ctx.state.settings.adBlock } })
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
    run: (ctx) => ctx.ui.openLibrary('archive')
  },
  {
    id: 'close-tab',
    title: 'Close Tab',
    shortcut: '⌘W',
    enabled: hasTab,
    run: (ctx) => dispatch({ type: 'tab/close', id: ctx.activeTabId! })
  }
]

/** "Split Layout: Grid (2 × 2)" and the other ready-made layouts. */
const LAYOUT_COMMANDS: Command[] = SPLIT_LAYOUTS.map((l) => ({
  id: `layout-${l.preset}`,
  title: `Split Layout: ${l.label}`,
  keywords: 'split view side by side columns grid panes',
  enabled: hasTab,
  run: (ctx) => dispatch({ type: 'split/layout', id: ctx.activeTabId!, preset: l.preset })
}))

const SPACE_COMMANDS: Command[] = [
  {
    id: 'new-space',
    title: 'New Space',
    keywords: 'create workspace',
    run: async (ctx) => ctx.ui.editSpace((await dispatch({ type: 'space/new' })) as string, true)
  },
  {
    id: 'edit-space',
    title: 'Edit Space Theme…',
    keywords: 'color colour rename emoji icon appearance dark light profile',
    run: (ctx) => ctx.ui.editSpace(ctx.state.activeSpaceId)
  },
  {
    id: 'manage-spaces',
    title: 'Manage Spaces…',
    keywords: 'library columns move tabs organize',
    run: (ctx) => ctx.ui.openLibrary('spaces')
  },
  {
    id: 'export-bookmarks',
    title: 'Export Tabs as Bookmarks…',
    keywords: 'save html backup space',
    run: (ctx) => dispatch({ type: 'space/exportBookmarks', id: ctx.state.activeSpaceId })
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
  return [...COMMANDS, ...LAYOUT_COMMANDS, ...SPACE_COMMANDS, ...perSpaceCommands(ctx)].filter((c) => {
    if (c.enabled && !c.enabled(ctx)) return false
    const hay = `${c.title} ${c.keywords ?? ''}`.toLowerCase()
    return words.every((w) => hay.includes(w))
  })
}
