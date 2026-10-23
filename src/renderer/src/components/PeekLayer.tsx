import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { AppState, TabItem } from '../../../shared/types'
import { displayHost } from '../../../shared/url'
import { dispatch } from '../state'
import { Favicon } from './Favicon'
import { IconClose, IconExpand } from './Icons'

/**
 * Peek: a link opened from a pinned tab shows in a floating card over the page.
 * The card's body is where the brain places the live page.
 */
export function PeekLayer({ state, peek }: { state: AppState; peek: TabItem }) {
  const body = useRef<HTMLDivElement>(null)
  const [closing, setClosing] = useState(false)
  const loading = state.runtime[peek.id]?.loading

  useLayoutEffect(() => {
    const el = body.current
    if (!el) return
    const report = () => {
      const r = el.getBoundingClientRect()
      window.vaia.setPeekRect({ x: r.left, y: r.top, width: r.width, height: r.height })
    }
    // Wait for the open animation to finish so the page lands exactly in the card.
    const t = setTimeout(report, 190)
    const observer = new ResizeObserver(report)
    observer.observe(el)
    return () => {
      clearTimeout(t)
      observer.disconnect()
    }
  }, [peek.id])

  const close = () => {
    window.vaia.setPeekRect(null)
    setClosing(true)
    setTimeout(() => dispatch({ type: 'peek/close' }), 120)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className={`peek-layer${closing ? ' closing' : ''}`} onMouseDown={close}>
      <div className="peek-card" onMouseDown={(e) => e.stopPropagation()}>
        <div className="peek-head">
          <span className={`tab-icon${loading ? ' loading' : ''}`}>
            <Favicon src={peek.favicon} url={peek.url} />
          </span>
          <span className="peek-title">{peek.title && peek.title !== peek.url ? peek.title : displayHost(peek.url)}</span>
          <span className="peek-host">{displayHost(peek.url)}</span>
          <button className="peek-button" title="Open as a tab" onClick={() => dispatch({ type: 'peek/expand' })}>
            <IconExpand />
            <span>Open as Tab</span>
          </button>
          <button className="peek-button icon" title="Close (Esc)" onClick={close}>
            <IconClose />
          </button>
        </div>
        <div className="peek-body" ref={body} />
      </div>
    </div>
  )
}
