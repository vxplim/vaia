import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { locate } from '../../../shared/tree'
import type { AppState, Pane, Space, SplitItem, TabItem } from '../../../shared/types'
import { displayHost } from '../../../shared/url'
import { useDnd } from '../dnd'
import { showLayoutMenu } from '../splitLayouts'
import { dispatch } from '../state'
import { IconBack, IconClose, IconForward, IconLayout, IconReload, IconStop } from './Icons'

interface Props {
  state: AppState
  space: Space
  /** When true, live pages are swapped for still pictures so overlays can sit on top. */
  frozen: boolean
  /** Find-in-page bar shown above the page (or null). */
  findBar: ReactNode
  /** Told when the live pages have been swapped for pictures (true) or are back (false). */
  onFrozen?: (frozen: boolean) => void
}

let lastSent = ''

/** Send the page positions to the brain, skipping repeats. */
export function sendPanes(panes: Pane[]): void {
  const key = JSON.stringify(panes)
  if (key === lastSent) return
  lastSent = key
  window.vaia.setPanes(panes)
}

const MIN_PANE = 0.15

/**
 * The rounded "cards" where web pages appear: one, or 2–4 side by side in Split
 * View. The pages are drawn by the brain on top of these exact spots; we
 * measure each card and report where it is.
 */
export function Content({ state, space, frozen, findBar, onFrozen }: Props) {
  const { drag, setDrag, setIndicator } = useDnd()
  const loc = space.activeId ? locate(state, space.activeId) : null
  const split = loc?.item.kind === 'split' ? loc.item : null
  const tabs: TabItem[] = !loc ? [] : loc.item.kind === 'tab' ? [loc.item] : split ? split.tabs : []
  const tabKey = tabs.map((t) => `${t.id}:${t.url ? 1 : 0}`).join(',')

  const [liveSizes, setLiveSizes] = useState<number[] | null>(null)
  const sizes = liveSizes ?? (split && split.sizes.length === tabs.length ? split.sizes : tabs.map(() => 1 / tabs.length))
  const isGrid = !!split && split.layout === 'grid' && tabs.length === 4
  const [liveGrid, setLiveGrid] = useState<{ col: number; row: number } | null>(null)
  const grid = liveGrid ?? split?.grid ?? { col: 0.5, row: 0.5 }

  // Dragging a tab from the sidebar onto the page makes a split.
  const canDropTab = drag?.kind === 'tab' && !tabs.some((t) => t.id === drag.id) && tabs.length < 4
  const [dropSide, setDropSide] = useState<'left' | 'right' | null>(null)

  const [snapshots, setSnapshots] = useState<Record<string, string>>({})
  const [hidden, setHidden] = useState(false)
  const freeze = frozen || canDropTab

  const container = useRef<HTMLDivElement>(null)
  useEffect(() => onFrozen?.(hidden), [hidden, onFrozen])
  const paneEls = useRef(new Map<string, HTMLDivElement>())

  // Freezing: take pictures, wait until they're ready to draw, THEN hide the live pages.
  useEffect(() => {
    if (!freeze) {
      setHidden(false)
      // Keep the pictures a moment so there's no blank flash while the pages return.
      const t = setTimeout(() => setSnapshots({}), 80)
      return () => clearTimeout(t)
    }
    const ids = tabs.filter((t) => t.url).map((t) => t.id)
    let cancelled = false
    window.vaia.capture(ids).then(async (shots) => {
      await Promise.all(
        Object.values(shots).map((src) => {
          const img = new Image()
          img.src = src
          return img.decode().catch(() => {})
        })
      )
      if (cancelled) return
      setSnapshots(shots)
      setHidden(true)
    })
    return () => {
      cancelled = true
    }
  }, [freeze, tabKey])

  useLayoutEffect(() => {
    const report = () => {
      if (hidden) return sendPanes([])
      const panes: Pane[] = []
      for (const tab of tabs) {
        const el = paneEls.current.get(tab.id)
        if (!tab.url || !el) continue
        const r = el.getBoundingClientRect()
        panes.push({ tabId: tab.id, rect: { x: r.left, y: r.top, width: r.width, height: r.height } })
      }
      sendPanes(panes)
    }
    report()
    const observer = new ResizeObserver(report)
    if (container.current) observer.observe(container.current)
    window.addEventListener('resize', report)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', report)
    }
  }, [tabKey, hidden, sizes.join(','), isGrid, grid.col, grid.row])

  const startResize = (index: number) => (e: PointerEvent<HTMLDivElement>) => {
    const el = container.current
    if (!el || !split) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const startX = e.clientX
    const width = el.getBoundingClientRect().width
    const start = [...sizes]
    let latest = start
    const move = (ev: globalThis.PointerEvent) => {
      const delta = (ev.clientX - startX) / width
      const pair = start[index] + start[index + 1]
      const left = Math.min(pair - MIN_PANE, Math.max(MIN_PANE, start[index] + delta))
      latest = start.map((s, i) => (i === index ? left : i === index + 1 ? pair - left : s))
      setLiveSizes(latest)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      dispatch({ type: 'split/resize', id: split.id, sizes: latest })
      // Wait for the saved sizes to arrive before letting go of our local copy.
      setTimeout(() => setLiveSizes(null), 60)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  /** Drag the grid's middle lines: 'col' moves the vertical one, 'row' the horizontal one, 'both' the crossing. */
  const startGridResize = (axis: 'col' | 'row' | 'both') => (e: PointerEvent<HTMLDivElement>) => {
    const el = container.current
    if (!el || !split) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const r = el.getBoundingClientRect()
    let latest = grid
    const move = (ev: globalThis.PointerEvent) => {
      const clamp = (v: number) => Math.min(0.85, Math.max(0.15, v))
      latest = {
        col: axis === 'row' ? latest.col : clamp((ev.clientX - r.left) / r.width),
        row: axis === 'col' ? latest.row : clamp((ev.clientY - r.top) / r.height)
      }
      setLiveGrid(latest)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      dispatch({ type: 'split/resizeGrid', id: split.id, ...latest })
      setTimeout(() => setLiveGrid(null), 60)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  const even = () => split && dispatch({ type: 'split/even', id: split.id })

  const pane = (tab: TabItem) => (
    <>
      {split && <PaneToolbar tab={tab} split={split} state={state} />}
      <div
        className={`content-card${split && split.focusedId === tab.id ? ' focused' : ''}`}
        ref={(el) => {
          if (el) paneEls.current.set(tab.id, el)
          else paneEls.current.delete(tab.id)
        }}
        onMouseDown={() => split && dispatch({ type: 'tab/activate', id: tab.id })}
      >
        {tab.url && snapshots[tab.id] && hidden && <img className="page-snapshot" src={snapshots[tab.id]} alt="" />}
        {state.runtime[tab.id]?.crashed && (
          <div className="empty-state crashed">
            <div className="empty-mark">Oops</div>
            <p>This page crashed. Your other tabs are fine.</p>
            <button className="primary-button" onClick={() => dispatch({ type: 'tab/reload', id: tab.id })}>
              Reload
            </button>
          </div>
        )}
        {!tab.url && (split ? <EmptyPane /> : <EmptyState />)}
      </div>
    </>
  )

  return (
    <main
      className="content-wrap"
      onDragOver={(e) => {
        if (!canDropTab) return
        e.preventDefault()
        const r = e.currentTarget.getBoundingClientRect()
        const side = e.clientX < r.left + r.width / 2 ? 'left' : 'right'
        if (side !== dropSide) setDropSide(side)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropSide(null)
      }}
      onDrop={(e) => {
        if (!canDropTab || !drag) return
        e.preventDefault()
        dispatch({ type: 'split/add', tabId: drag.id, side: dropSide ?? 'right' })
        setDropSide(null)
        setDrag(null)
        setIndicator(null)
      }}
    >
      {findBar}
      <div className="panes" ref={container}>
        {tabs.length === 0 && (
          <div className="content-card">
            <EmptyState />
          </div>
        )}
        {isGrid ? (
          <div
            className="pane-grid"
            style={{
              gridTemplateColumns: `${grid.col}fr ${1 - grid.col}fr`,
              gridTemplateRows: `${grid.row}fr ${1 - grid.row}fr`
            }}
          >
            {tabs.map((tab) => (
              <div key={tab.id} className="pane-slot">
                {pane(tab)}
              </div>
            ))}
            <div
              className="grid-divider row"
              style={{ top: `calc(${grid.row * 100}% - 4px)` }}
              onPointerDown={startGridResize('row')}
              onDoubleClick={even}
              title="Drag to resize · double-click to make even"
            />
            <div
              className="grid-divider col"
              style={{ left: `calc(${grid.col * 100}% - 4px)` }}
              onPointerDown={startGridResize('col')}
              onDoubleClick={even}
              title="Drag to resize · double-click to make even"
            />
            <div
              className="grid-divider both"
              style={{ left: `calc(${grid.col * 100}% - 8px)`, top: `calc(${grid.row * 100}% - 8px)` }}
              onPointerDown={startGridResize('both')}
              onDoubleClick={even}
              title="Drag to resize both ways · double-click to make even"
            />
          </div>
        ) : (
          tabs.map((tab, i) => (
            <div key={tab.id} className="pane-slot" style={{ flexGrow: sizes[i] ?? 1 }}>
              {i > 0 && (
                <div
                  className="split-divider"
                  onPointerDown={startResize(i - 1)}
                  onDoubleClick={even}
                  title="Drag to resize · double-click to make even"
                />
              )}
              {pane(tab)}
            </div>
          ))
        )}
        {canDropTab && hidden && (
          <div className="drop-zones">
            <div className={`drop-zone${dropSide === 'left' ? ' active' : ''}`}>
              {dropSide === 'left' && <span>Open on the left</span>}
            </div>
            <div className={`drop-zone${dropSide === 'right' ? ' active' : ''}`}>
              {dropSide === 'right' && <span>Open on the right</span>}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

/** An empty Split View pane: its toolbar's address field is waiting for you. */
function EmptyPane() {
  return (
    <div className="empty-state">
      <p>Type an address or search above.</p>
    </div>
  )
}

/** The slim toolbar on top of each Split View pane. */
function PaneToolbar({ tab, split, state }: { tab: TabItem; split: SplitItem; state: AppState }) {
  const rt = state.runtime[tab.id]
  const [editing, setEditing] = useState(!tab.url)
  const [text, setText] = useState('')
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!editing) return
    setText(tab.url)
    requestAnimationFrame(() => input.current?.select())
  }, [editing])
  const submit = () => {
    if (text.trim()) dispatch({ type: 'tab/navigate', id: tab.id, input: text })
    if (text.trim() || tab.url) setEditing(false)
  }
  return (
    <div className={`pane-toolbar${split.focusedId === tab.id ? ' focused' : ''}`} onMouseDown={() => dispatch({ type: 'tab/activate', id: tab.id })}>
      <button className="pane-button" title="Back" disabled={!rt?.canGoBack} onClick={() => dispatch({ type: 'tab/back', id: tab.id })}>
        <IconBack />
      </button>
      <button
        className="pane-button"
        title="Forward"
        disabled={!rt?.canGoForward}
        onClick={() => dispatch({ type: 'tab/forward', id: tab.id })}
      >
        <IconForward />
      </button>
      <button
        className="pane-button"
        title={rt?.loading ? 'Stop' : 'Reload'}
        disabled={!tab.url}
        onClick={() => dispatch({ type: rt?.loading ? 'tab/stop' : 'tab/reload', id: tab.id })}
      >
        {rt?.loading ? <IconStop /> : <IconReload />}
      </button>
      {editing ? (
        <input
          ref={input}
          className="pane-address editing"
          value={text}
          autoFocus
          spellCheck={false}
          placeholder="Search or enter address"
          onChange={(e) => setText(e.target.value)}
          onBlur={() => tab.url && setEditing(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
            if (e.key === 'Escape' && tab.url) setEditing(false)
          }}
        />
      ) : (
        <button className="pane-address" title={tab.url} onClick={() => setEditing(true)}>
          {displayHost(tab.url) || 'New Tab'}
        </button>
      )}
      <button className="pane-button" title="Layout" onClick={() => showLayoutMenu(split.id, split)}>
        <IconLayout />
      </button>
      <button
        className="pane-button"
        title="Remove this pane (it stays open as a tab)"
        onClick={() => dispatch(tab.url ? { type: 'split/detach', tabId: tab.id } : { type: 'tab/close', id: tab.id })}
      >
        <IconClose />
      </button>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="empty-state">
      <div className="empty-mark">VAIA</div>
      <p>Press ⌘T to open a site or search.</p>
      <p className="hint">
        <kbd>⌘</kbd>
        <kbd>T</kbd> command bar · <kbd>⌘</kbd>
        <kbd>L</kbd> address bar
      </p>
    </div>
  )
}
