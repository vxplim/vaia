import { useLayoutEffect, useRef } from 'react'
import type { Pane, TabItem } from '../../../shared/types'

interface Props {
  tab: TabItem | null
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
export function Content({ tab }: Props) {
  const card = useRef<HTMLDivElement>(null)
  const showPage = !!tab?.url

  useLayoutEffect(() => {
    const el = card.current
    if (!el) return
    const report = () => {
      if (!tab || !showPage) return sendPanes([])
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
  }, [tab?.id, showPage])

  return (
    <main className="content-wrap">
      <div className="content-card" ref={card}>
        {!showPage && (
          <div className="empty-state">
            <div className="empty-mark">VAIA</div>
            <p>Type an address or search in the sidebar.</p>
            <p className="hint">
              <kbd>⌘</kbd>
              <kbd>T</kbd> new tab · <kbd>⌘</kbd>
              <kbd>L</kbd> address bar
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
