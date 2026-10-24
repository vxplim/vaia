import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { allTabs, tabLabel } from '../../../shared/tree'
import type { AppState, HistoryEntry } from '../../../shared/types'
import { SEARCH_ENGINES, displayHost, inputToUrl, searchUrl } from '../../../shared/url'
import { matchCommands, type CommandContext } from '../commands'
import { dispatch } from '../state'
import { Favicon } from './Favicon'
import { IconCheckCircle, IconGlobe, IconSearch } from './Icons'

interface Result {
  key: string
  icon: ReactNode
  title: string
  subtitle?: string
  label: string
  run: () => void
}

interface Props {
  state: AppState
  activeTabId: string | null
  /** 'split' = whatever you pick opens in a new Split View pane. */
  mode: 'new' | 'split'
  closing: boolean
  onClose: () => void
  ui: CommandContext['ui']
}

const CommandIcon = () => <span className="cmd-glyph">⌘</span>

/** The floating, Spotlight-style bar for opening sites, switching tabs and running commands. */
export function CommandBar({ state, activeTabId, mode, closing, onClose, ui }: Props) {
  const [query, setQuery] = useState('')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const engine = state.settings.searchEngine

  useEffect(() => {
    input.current?.focus()
  }, [])

  // Ask the brain for suggestions + history, waiting briefly while you type.
  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setSuggestions([])
      setHistory([])
      return
    }
    let stale = false
    window.vaia.searchHistory(q).then((h) => !stale && setHistory(h))
    const timer = setTimeout(() => {
      window.vaia.suggest(q).then((s) => !stale && setSuggestions(s))
    }, 120)
    return () => {
      stale = true
      clearTimeout(timer)
    }
  }, [query])

  const results = useMemo(() => {
    const q = query.trim()
    const ql = q.toLowerCase()
    const ctx: CommandContext = { state, activeTabId, ui }
    const out: Result[] = []
    const openUrl = (url: string) => () =>
      dispatch(mode === 'split' ? { type: 'split/add', url } : { type: 'tab/new', url })
    const words = ql.split(/\s+/).filter(Boolean)

    // "todo buy milk" adds a to-do to this Space (optionally linked to the page you're on).
    const todoText = mode === 'new' ? /^(?:todo|to-do)\s+(.+)$/i.exec(q)?.[1]?.trim() : undefined
    if (todoText) {
      const activeTab = allTabs(state).find((t) => t.id === activeTabId && t.url)
      const add = (link: boolean) => () =>
        dispatch({ type: 'todo/add', text: todoText, spaceId: state.activeSpaceId, linkTabId: link ? activeTabId ?? undefined : undefined, confirm: true })
      out.push({
        key: 'todo-add',
        icon: <IconCheckCircle />,
        title: `Add to-do: ${todoText}`,
        label: 'To-do',
        run: add(false)
      })
      if (activeTab) {
        out.push({
          key: 'todo-add-link',
          icon: <IconCheckCircle />,
          title: `Add to-do and link this page: ${todoText}`,
          subtitle: tabLabel(activeTab),
          label: 'To-do',
          run: add(true)
        })
      }
    }

    const commands = matchCommands(q, ctx).slice(0, q ? 3 : 4)
    const commandRows = commands.map(
      (c): Result => ({
        key: `cmd-${c.id}`,
        icon: <CommandIcon />,
        title: c.title,
        label: c.shortcut ?? 'Command',
        run: () => c.run(ctx)
      })
    )
    // "copy" -> "Copy URL" first: a command whose name starts with what you typed wins.
    const commandFirst = q.length >= 2 && commands[0]?.title.toLowerCase().startsWith(ql)
    if (commandFirst && mode === 'new') out.push(commandRows.shift()!)

    if (q) {
      const url = inputToUrl(q, engine)
      const isSearch = url === searchUrl(q, engine)
      out.push({
        key: 'primary',
        icon: isSearch ? <IconSearch /> : <IconGlobe />,
        title: isSearch ? q : displayHost(url),
        subtitle: isSearch ? undefined : url,
        label: isSearch ? `Search ${SEARCH_ENGINES[engine].name}` : 'Open',
        run: openUrl(url)
      })
    }

    // Open tabs anywhere in VAIA (most recently viewed first).
    const tabs = allTabs(state)
      .filter((t) => t.id !== activeTabId && t.url)
      .filter((t) => words.every((w) => `${tabLabel(t)} ${t.title} ${t.url}`.toLowerCase().includes(w)))
      .sort((a, b) => b.lastViewedAt - a.lastViewedAt)
      .slice(0, q ? 4 : 5)
    for (const t of tabs) {
      out.push({
        key: `tab-${t.id}`,
        icon: <Favicon src={t.favicon} url={t.url} />,
        title: tabLabel(t),
        subtitle: displayHost(t.url),
        label: mode === 'split' ? 'Open in Split' : 'Switch to Tab',
        run: () => dispatch(mode === 'split' ? { type: 'split/add', tabId: t.id } : { type: 'tab/activate', id: t.id })
      })
    }

    if (mode === 'new') out.push(...commandRows)

    if (q) {
      const openUrls = new Set(tabs.map((t) => t.url))
      for (const h of history.filter((h) => !openUrls.has(h.url)).slice(0, 4)) {
        out.push({
          key: `hist-${h.url}`,
          icon: <Favicon src={h.favicon} url={h.url} />,
          title: h.title,
          subtitle: displayHost(h.url),
          label: 'History',
          run: openUrl(h.url)
        })
      }
      for (const s of suggestions.filter((s) => s.toLowerCase() !== ql).slice(0, 4)) {
        out.push({
          key: `sug-${s}`,
          icon: <IconSearch />,
          title: s,
          label: 'Search',
          run: openUrl(searchUrl(s, engine))
        })
      }
    }
    return out
  }, [query, state, activeTabId, history, suggestions, engine, ui, mode])

  // Remember the highlighted row by its key, so late-arriving suggestions don't move it.
  const found = results.findIndex((r) => r.key === selectedKey)
  const selected = found >= 0 ? found : 0
  const select = (i: number) => setSelectedKey(results[i]?.key ?? null)

  useEffect(() => setSelectedKey(null), [query])

  useEffect(() => {
    list.current?.querySelector('.cmd-row.selected')?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  const choose = (r: Result | undefined) => {
    if (!r) return
    onClose()
    r.run()
  }

  return (
    <div className={`cmd-layer${closing ? ' closing' : ''}`} onMouseDown={onClose}>
      <div className="cmd-bar" onMouseDown={(e) => e.stopPropagation()}>
        <div className="cmd-input-row">
          <IconSearch className="cmd-input-icon" />
          <input
            ref={input}
            className="cmd-input"
            value={query}
            spellCheck={false}
            placeholder={mode === 'split' ? 'Open in a new Split View pane…' : 'Search, open a site, or run a command…'}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                select((selected + 1) % Math.max(results.length, 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                select((selected - 1 + results.length) % Math.max(results.length, 1))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                choose(results[selected])
              } else if (e.key === 'Escape') {
                e.preventDefault()
                onClose()
              }
            }}
          />
        </div>
        {results.length > 0 && (
          <div className="cmd-results" ref={list}>
            {results.map((r, i) => (
              <div
                key={r.key}
                className={`cmd-row${i === selected ? ' selected' : ''}`}
                onMouseMove={() => i !== selected && select(i)}
                onClick={() => choose(r)}
              >
                <span className="cmd-row-icon">{r.icon}</span>
                <span className="cmd-row-text">
                  <span className="cmd-row-title">{r.title}</span>
                  {r.subtitle && <span className="cmd-row-subtitle">{r.subtitle}</span>}
                </span>
                <span className="cmd-row-label">{r.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
