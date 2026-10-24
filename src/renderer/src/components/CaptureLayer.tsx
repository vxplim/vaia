import { useEffect, useState, type PointerEvent } from 'react'
import type { AppState, Rect } from '../../../shared/types'
import { dispatch } from '../state'

type To = 'copy' | 'media' | 'easel'

/** ⇧⌘2: drag over the page to pick what to capture (or take everything you can see). */
export function CaptureLayer({ state, tabId, closing, onClose }: { state: AppState; tabId: string; closing: boolean; onClose: () => void }) {
  const [card, setCard] = useState<DOMRect | null>(null)
  const [start, setStart] = useState<{ x: number; y: number } | null>(null)
  const [sel, setSel] = useState<Rect | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const el = document.querySelector(`.content-card[data-tab-id="${tabId}"]`)
    setCard(el ? el.getBoundingClientRect() : null)
  }, [tabId])
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onClose])

  const clamp = (x: number, y: number) => ({
    x: Math.min(Math.max(x, card!.left), card!.right),
    y: Math.min(Math.max(y, card!.top), card!.bottom)
  })
  const down = (e: PointerEvent) => {
    if (!card || (e.target as Element).closest('.capture-bar')) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = clamp(e.clientX, e.clientY)
    setStart(p)
    setSel({ ...p, width: 0, height: 0 })
    setDone(false)
  }
  const move = (e: PointerEvent) => {
    if (!start || done || !card) return
    const p = clamp(e.clientX, e.clientY)
    setSel({ x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), width: Math.abs(p.x - start.x), height: Math.abs(p.y - start.y) })
  }
  const up = () => {
    if (!start) return
    setStart(null)
    if (sel && sel.width > 6 && sel.height > 6) setDone(true)
    else setSel(null)
  }

  /** Close first (so the live page comes back), then take the picture. */
  const take = async (to: To, whole = false) => {
    if (!card) return
    let easelId: string | undefined
    if (to === 'easel') {
      const easels = state.docs.filter((d) => d.kind === 'easel')
      const choice = await window.vaia.popupMenu([
        ...easels.map((d) => ({ id: d.id, label: d.title })),
        ...(easels.length ? [{ type: 'separator' as const }] : []),
        { id: 'new', label: 'New Easel' }
      ])
      if (!choice) return
      easelId = choice === 'new' ? undefined : choice
    }
    const rect = whole || !sel ? null : { x: sel.x - card.left, y: sel.y - card.top, width: sel.width, height: sel.height }
    onClose()
    dispatch({ type: 'capture/take', tabId, rect, to, easelId })
  }

  if (!card) {
    return (
      <div className={`cmd-layer${closing ? ' closing' : ''}`} onMouseDown={onClose}>
        <div className="cmd-bar capture-message">Only web pages can be captured. Open a page and press ⇧⌘2.</div>
      </div>
    )
  }
  const bar = done && sel ? { left: Math.min(sel.x, window.innerWidth - 340), top: Math.min(sel.y + sel.height + 8, window.innerHeight - 48) } : null

  return (
    <div className={`capture-layer${closing ? ' closing' : ''}`} onPointerDown={down} onPointerMove={move} onPointerUp={up}>
      {/* Dim everything except the page, and inside the page everything except your selection. */}
      <div className="capture-shade" style={{ clipPath: shadeClip(card, sel) }} />
      {sel && <div className="capture-selection" style={{ left: sel.x, top: sel.y, width: sel.width, height: sel.height }} />}
      {!sel && (
        <div className="capture-bar top" style={{ left: card.left + card.width / 2 }}>
          <span>Drag over the page to capture part of it</span>
          <button className="text-button small" onClick={() => take('copy', true)}>Copy whole page</button>
          <button className="text-button small" onClick={() => take('media', true)}>Save whole page</button>
          <button className="text-button small" onClick={() => take('easel', true)}>Whole page to Easel…</button>
          <button className="text-button small" onClick={onClose}>Cancel</button>
        </div>
      )}
      {bar && (
        <div className="capture-bar" style={bar}>
          <button className="primary-button small" onClick={() => take('copy')}>Copy</button>
          <button className="text-button small" onClick={() => take('media')}>Save to Media</button>
          <button className="text-button small" onClick={() => take('easel')}>Add to Easel…</button>
          <button className="text-button small" onClick={onClose}>Cancel</button>
        </div>
      )}
    </div>
  )
}

/** A clip-path that covers the window but leaves a hole for the selection. */
function shadeClip(card: DOMRect, sel: Rect | null): string {
  if (!sel || sel.width < 1) return 'none'
  const { x, y, width, height } = sel
  return `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${x}px ${y}px, ${x + width}px ${y}px, ${x + width}px ${y + height}px, ${x}px ${y + height}px, ${x}px ${y}px)`
}
