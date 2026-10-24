import { tabLabel } from '../../../shared/tree'
import type { AppState, TabItem } from '../../../shared/types'
import { displayHost } from '../../../shared/url'
import { Favicon } from './Favicon'

/** This Space's tabs and the favorites, most recently viewed first (the one on screen at the top). */
export function recentTabs(state: AppState, activeTabId: string | null): string[] {
  const space = state.spaces.find((s) => s.id === state.activeSpaceId) ?? state.spaces[0]
  const flatten = (items: AppState['spaces'][number]['today']): TabItem[] =>
    items.flatMap((i) => (i.kind === 'tab' ? [i] : i.kind === 'split' ? i.tabs : flatten(i.children)))
  const tabs = [...state.favorites, ...flatten(space.pinned), ...flatten(space.today)].filter((t) => t.url)
  tabs.sort((a, b) => (a.id === activeTabId ? -1 : b.id === activeTabId ? 1 : b.lastViewedAt - a.lastViewedAt))
  return tabs.map((t) => t.id)
}

/** Ctrl+Tab: recent tabs while Ctrl is held. Tab moves on, Shift+Tab back, letting go of Ctrl picks. */
export function TabSwitcher({
  state,
  ids,
  index,
  closing,
  onPick,
  onClose
}: {
  state: AppState
  ids: string[]
  index: number
  closing: boolean
  onPick: (id: string) => void
  onClose: () => void
}) {
  const byId = new Map<string, TabItem>()
  for (const t of [...state.favorites, ...state.spaces.flatMap((s) => [...s.pinned, ...s.today])]) {
    const add = (i: typeof t): void => {
      if (i.kind === 'tab') byId.set(i.id, i)
      else if (i.kind === 'split') i.tabs.forEach((x) => byId.set(x.id, x))
      else i.children.forEach(add)
    }
    add(t)
  }
  const tabs = ids.map((id) => byId.get(id)).filter((t): t is TabItem => !!t)
  // Show a window of up to 9 tabs around the highlighted one.
  const start = Math.max(0, Math.min(index - 4, tabs.length - 9))
  return (
    <div className={`cmd-layer switcher-layer${closing ? ' closing' : ''}`} onMouseDown={onClose}>
      <div className="cmd-bar tab-switcher" onMouseDown={(e) => e.stopPropagation()}>
        {tabs.slice(start, start + 9).map((t, i) => (
          <div
            key={t.id}
            className={`switcher-row${start + i === index ? ' selected' : ''}`}
            role="button"
            onClick={() => onPick(t.id)}
          >
            <Favicon src={t.favicon} url={t.url} />
            <span className="switcher-title">{tabLabel(t)}</span>
            <span className="switcher-host">{displayHost(t.url)}</span>
          </div>
        ))}
        {tabs.length === 0 && <div className="list-empty small">No other tabs yet</div>}
        <div className="switcher-hint">Hold ⌃ and press Tab to move · let go to switch · Esc to cancel</div>
      </div>
    </div>
  )
}
