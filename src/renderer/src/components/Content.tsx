import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Pane, TabItem } from '../../../shared/types'

interface Props {
  tab: TabItem | null
  /** When true, the live page is swapped for a still picture so overlays can sit on top. */
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

/**
 * The rounded "card" where web pages appear. The page itself is drawn by the
 * brain on top of this exact spot; we just measure and report where it is.
 */
export function Content({ tab, frozen }: Props) {
  const card = useRef<HTMLDivElement>(null)
  const [snapshot, setSnapshot] = useState<string | null>(null)
  // "hidden" = the live page has been removed and the picture is showing.
  const [hidden, setHidden] = useState(false)
  const showPage = !!tab?.url

  // Freezing: take a picture first, show it, THEN remove the live page.
  useEffect(() => {
    if (!frozen) {
      setHidden(false)
      // Keep the picture a moment so there's no blank flash while the page returns.
      const t = setTimeout(() => setSnapshot(null), 80)
      return () => clearTimeout(t)
    }
    if (!tab || !showPage) {
      setHidden(true)
      return
    }
    let cancelled = false
    window.vaia.capture([tab.id]).then((shots) => {
      if (cancelled) return
      const src = shots[tab.id]
      if (src) setSnapshot(src)
      else setHidden(true)
    })
    return () => {
      cancelled = true
    }
  }, [frozen, tab?.id, showPage])

  useLayoutEffect(() => {
    const el = card.current
    if (!el) return
    const report = () => {
      if (!tab || !showPage || hidden) return sendPanes([])
      const r = el.getBoundingClientRect()
      sendPanes([{ tabId: tab.id, rect: { x: r.left, y: r.top, width: r.width, height: r.height } }])
    }
    report()
    const observer = new ResizeObserver(report)
    observer.observe(el)
    window.addEventListener('resize', report)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', report)
    }
  }, [tab?.id, showPage, hidden])

  return (
    <main className="content-wrap">
      <div className="content-card" ref={card}>
        {snapshot && showPage && (
          <img className="page-snapshot" src={snapshot} alt="" onLoad={() => frozen && setHidden(true)} />
        )}
        {!showPage && (
          <div className="empty-state">
            <div className="empty-mark">VAIA</div>
            <p>Press ⌘T to open a site or search.</p>
            <p className="hint">
              <kbd>⌘</kbd>
              <kbd>T</kbd> command bar · <kbd>⌘</kbd>
              <kbd>L</kbd> address bar
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
