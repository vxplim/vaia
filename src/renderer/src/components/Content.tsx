import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react'
import { locate } from '../../../shared/tree'
import type { AppState, Pane, Space, TabItem } from '../../../shared/types'
import { useDnd } from '../dnd'
import { dispatch } from '../state'

interface Props {
  state: AppState
  space: Space
  /** When true, live pages are swapped for still pictures so overlays can sit on top. */
  frozen: boolean
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
export function Content({ state, space, frozen }: Props) {
  const { drag, setDrag, setIndicator } = useDnd()
  const loc = space.activeId ? locate(state, space.activeId) : null
  const split = loc?.item.kind === 'split' ? loc.item : null
  const tabs: TabItem[] = !loc ? [] : loc.item.kind === 'tab' ? [loc.item] : split ? split.tabs : []
  const tabKey = tabs.map((t) => `${t.id}:${t.url ? 1 : 0}`).join(',')

  const [liveSizes, setLiveSizes] = useState<number[] | null>(null)
  const sizes = liveSizes ?? (split && split.sizes.length === tabs.length ? split.sizes : tabs.map(() => 1 / tabs.length))

  // Dragging a tab from the sidebar onto the page makes a split.
  const canDropTab = drag?.kind === 'tab' && !tabs.some((t) => t.id === drag.id) && tabs.length < 4
  const [dropSide, setDropSide] = useState<'left' | 'right' | null>(null)

  const [snapshots, setSnapshots] = useState<Record<string, string>>({})
  const [hidden, setHidden] = useState(false)
  const freeze = frozen || canDropTab

  const container = useRef<HTMLDivElement>(null)
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
  }, [tabKey, hidden, sizes.join(',')])

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
      <div className="panes" ref={container}>
        {tabs.length === 0 && (
          <div className="content-card">
            <EmptyState />
          </div>
        )}
        {tabs.map((tab, i) => (
          <div key={tab.id} className="pane-slot" style={{ flexGrow: sizes[i] ?? 1 }}>
            {i > 0 && <div className="split-divider" onPointerDown={startResize(i - 1)} />}
            <div
              className={`content-card${split && split.focusedId === tab.id ? ' focused' : ''}`}
              ref={(el) => {
                if (el) paneEls.current.set(tab.id, el)
                else paneEls.current.delete(tab.id)
              }}
              onMouseDown={() => split && dispatch({ type: 'tab/activate', id: tab.id })}
            >
              {tab.url && snapshots[tab.id] && hidden && (
                <img className="page-snapshot" src={snapshots[tab.id]} alt="" />
              )}
              {!tab.url && <EmptyState />}
            </div>
          </div>
        ))}
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
