// App commands you can run from the Command Bar (⌘T), e.g. "Toggle Sidebar".
import type { AppState } from '../../shared/types'
import { dispatch } from './state'

export interface CommandContext {
  state: AppState
  activeTabId: string | null
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
    id: 'close-tab',
    title: 'Close Tab',
    shortcut: '⌘W',
    enabled: hasTab,
    run: (ctx) => dispatch({ type: 'tab/close', id: ctx.activeTabId! })
  }
]

/** Commands whose title or keywords contain every typed word. */
export function matchCommands(query: string, ctx: CommandContext): Command[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  return COMMANDS.filter((c) => {
    if (c.enabled && !c.enabled(ctx)) return false
    const hay = `${c.title} ${c.keywords ?? ''}`.toLowerCase()
    return words.every((w) => hay.includes(w))
  })
}
