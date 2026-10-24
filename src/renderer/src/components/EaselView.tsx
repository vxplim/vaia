import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { EaselItem } from '../../../shared/types'
import { displayHost } from '../../../shared/url'
import { dispatch, useAppState } from '../state'
import { IconTrash } from './Icons'

const SAVE_DELAY_MS = 400
const MIN_SIZE = 40

const newItemId = () => crypto.randomUUID()

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

/** The natural size of a picture, scaled down to fit in 480 × 480. */
function imageSize(src: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, 480 / Math.max(img.naturalWidth, img.naturalHeight, 1))
      resolve({ w: Math.max(MIN_SIZE, Math.round(img.naturalWidth * scale)), h: Math.max(MIN_SIZE, Math.round(img.naturalHeight * scale)) })
    }
    img.onerror = () => resolve({ w: 320, h: 220 })
    img.src = src
  })
}

const isWebUrl = (text: string) => /^https?:\/\/\S+$/i.test(text.trim())
const looksLikeImage = (url: string) => /\.(png|jpe?g|gif|webp|avif)(\?|#|$)/i.test(url)

/** An Easel: a canvas you can drop pictures, text, links and captures onto. Saved automatically. */
export function EaselView({ docId }: { docId: string }) {
  const state = useAppState()
  const [items, setItems] = useState<EaselItem[] | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const canvas = useRef<HTMLDivElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef<EaselItem[]>([])
  const title = state?.docs.find((d) => d.id === docId)?.title ?? 'Easel'
  const [name, setName] = useState(title)
  useEffect(() => setName(title), [title])

  const load = () =>
    window.vaia.getDoc(docId).then((doc) => {
      latest.current = doc?.items ?? []
      setItems(doc ? latest.current : null)
    })
  useEffect(() => {
    load()
  }, [docId])
  // Something was added from elsewhere (e.g. a capture): reload, unless you're busy here.
  const dragging = useRef(false)
  const updatedAt = state?.docs.find((d) => d.id === docId)?.updatedAt
  useEffect(() => {
    if (!timer.current && !editing && !dragging.current) load()
  }, [updatedAt])

  const commit = (next: EaselItem[], now = false) => {
    latest.current = next
    setItems(next)
    if (timer.current) clearTimeout(timer.current)
    const save = () => {
      timer.current = null
      dispatch({ type: 'doc/save', id: docId, patch: { items: latest.current } })
    }
    if (now) save()
    else timer.current = setTimeout(save, SAVE_DELAY_MS)
  }
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current)
        dispatch({ type: 'doc/save', id: docId, patch: { items: latest.current } })
      }
    },
    [docId]
  )

  /** Where on the canvas a point in the window is. */
  const canvasPoint = (clientX: number, clientY: number) => {
    const r = canvas.current!.getBoundingClientRect()
    return { x: Math.round(clientX - r.left + canvas.current!.scrollLeft), y: Math.round(clientY - r.top + canvas.current!.scrollTop) }
  }
  const add = (item: Omit<EaselItem, 'id'>) => {
    const created = { ...item, id: newItemId() }
    commit([...latest.current, created], true)
    setSelected(created.id)
    return created
  }
  const nextSpot = () => {
    const el = canvas.current
    return { x: (el?.scrollLeft ?? 0) + 60 + (latest.current.length % 6) * 24, y: (el?.scrollTop ?? 0) + 60 + (latest.current.length % 6) * 24 }
  }
  const addImage = async (src: string, at: { x: number; y: number }, sourceUrl?: string) => add({ kind: 'image', src, sourceUrl, ...at, ...(await imageSize(src)) })
  const addLink = (url: string, at: { x: number; y: number }) => add({ kind: 'link', url, ...at, w: 260, h: 72 })

  // Move or resize with the pointer.
  const startDrag = (item: EaselItem, mode: 'move' | 'resize') => (e: ReactPointerEvent) => {
    if (e.button !== 0 || editing === item.id) return
    e.preventDefault()
    e.stopPropagation()
    // Keep the keyboard on the canvas so ⌫ removes the selected item.
    canvas.current?.focus()
    setSelected(item.id)
    const start = { x: e.clientX, y: e.clientY }
    const from = { ...item }
    dragging.current = true
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - start.x
      const dy = ev.clientY - start.y
      const patch =
        mode === 'move'
          ? { x: Math.max(0, from.x + dx), y: Math.max(0, from.y + dy) }
          : { w: Math.max(MIN_SIZE, from.w + dx), h: Math.max(MIN_SIZE, from.h + dy) }
      latest.current = latest.current.map((i) => (i.id === item.id ? { ...i, ...patch } : i))
      setItems(latest.current)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      dragging.current = false
      commit(latest.current)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const remove = (id: string) => {
    commit(latest.current.filter((i) => i.id !== id), true)
    setSelected(null)
  }

  if (items === null) return <div className="empty-state"><p>Loading…</p></div>
  const height = Math.max(1600, ...items.map((i) => i.y + i.h + 200))
  const width = Math.max(2400, ...items.map((i) => i.x + i.w + 200))

  return (
    <div className="easel">
      <div className="note-toolbar">
        <input
          className="easel-title"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name !== title && dispatch({ type: 'doc/save', id: docId, patch: { title: name } })}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
        <span className="note-sep" />
        <button className="note-tool" onClick={() => setEditing(add({ kind: 'text', text: '', ...nextSpot(), w: 220, h: 90 }).id)}>
          Text
        </button>
        <button className="note-tool" onClick={() => (setLinkUrl('https://'), setLinkOpen(true))}>
          Link
        </button>
        <button className="note-tool" onClick={() => fileInput.current?.click()}>
          Picture
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={async (e) => {
            for (const file of [...(e.target.files ?? [])]) await addImage(await readAsDataUrl(file), nextSpot())
            e.target.value = ''
          }}
        />
        {linkOpen && (
          <input
            className="note-link-field"
            autoFocus
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onBlur={() => setLinkOpen(false)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setLinkOpen(false)
              if (e.key !== 'Enter') return
              setLinkOpen(false)
              const url = /^https?:/i.test(linkUrl) ? linkUrl : `https://${linkUrl}`
              if (looksLikeImage(url)) addImage(url, nextSpot(), url)
              else addLink(url, nextSpot())
            }}
          />
        )}
        <span className="note-saved">Drop pictures and links here · ⇧⌘2 captures from a page</span>
      </div>
      <div
        ref={canvas}
        className="easel-canvas"
        tabIndex={-1}
        onPointerDown={(e) => {
          if (e.target === e.currentTarget || (e.target as Element).classList.contains('easel-space')) {
            const empty = latest.current.find((i) => i.id === editing && i.kind === 'text' && !i.text?.trim())
            if (empty) remove(empty.id)
            setSelected(null)
            setEditing(null)
          }
        }}
        onDoubleClick={(e) => {
          if (e.target !== e.currentTarget && !(e.target as Element).classList.contains('easel-space')) return
          const at = canvasPoint(e.clientX, e.clientY)
          setEditing(add({ kind: 'text', text: '', x: at.x, y: at.y, w: 220, h: 90 }).id)
        }}
        onKeyDown={(e) => {
          if ((e.key === 'Backspace' || e.key === 'Delete') && selected && !editing) {
            e.preventDefault()
            remove(selected)
          }
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={async (e) => {
          e.preventDefault()
          const at = canvasPoint(e.clientX, e.clientY)
          const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith('image/'))
          for (const [i, file] of files.entries()) await addImage(await readAsDataUrl(file), { x: at.x + i * 24, y: at.y + i * 24 })
          if (files.length) return
          // A picture dragged from a web page brings its address (and the page it came from).
          const html = e.dataTransfer.getData('text/html')
          const img = html ? /<img[^>]+src="([^"]+)"/i.exec(html)?.[1] : null
          const uri = e.dataTransfer.getData('text/uri-list').split('\n')[0]?.trim() || e.dataTransfer.getData('text/plain').trim()
          if (img && /^https:/i.test(img)) return void addImage(img.replace(/&amp;/g, '&'), at, isWebUrl(uri) ? uri : undefined)
          if (isWebUrl(uri)) return void (looksLikeImage(uri) ? addImage(uri, at, uri) : addLink(uri, at))
          const text = e.dataTransfer.getData('text/plain')
          if (text.trim()) add({ kind: 'text', text, x: at.x, y: at.y, w: 240, h: 100 })
        }}
      >
        <div className="easel-space" style={{ width, height }} />
        {items.length === 0 && (
          <div className="easel-empty">Double-click to write · drop pictures and links · ⇧⌘2 on a page to capture</div>
        )}
        {items.map((item) => (
          <div
            key={item.id}
            className={`easel-item ${item.kind}${selected === item.id ? ' selected' : ''}`}
            style={{ left: item.x, top: item.y, width: item.w, height: item.h }}
            onPointerDown={startDrag(item, 'move')}
            onDoubleClick={(e) => {
              e.stopPropagation()
              if (item.kind === 'text') setEditing(item.id)
            }}
          >
            {item.kind === 'image' && <img src={item.src} alt="" draggable={false} />}
            {item.kind === 'text' &&
              (editing === item.id ? (
                <textarea
                  autoFocus
                  defaultValue={item.text}
                  onPointerDown={(e) => e.stopPropagation()}
                  // Saved as you type, so nothing is lost however you leave the box.
                  onChange={(e) => commit(latest.current.map((i) => (i.id === item.id ? { ...i, text: e.target.value } : i)))}
                  onBlur={(e) => {
                    setEditing(null)
                    if (!e.target.value.trim()) remove(item.id)
                  }}
                  onKeyDown={(e) => e.key === 'Escape' && (e.target as HTMLTextAreaElement).blur()}
                />
              ) : (
                <div className="easel-text">{item.text}</div>
              ))}
            {item.kind === 'link' && (
              <div className="easel-link">
                <span className="easel-link-host">{displayHost(item.url ?? '')}</span>
                <span className="easel-link-url">{item.url}</span>
              </div>
            )}
            {(item.kind === 'link' || item.sourceUrl) && (
              <button
                className="easel-source"
                title={`Open ${item.kind === 'link' ? item.url : item.sourceUrl}`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => dispatch({ type: 'tab/new', url: (item.kind === 'link' ? item.url : item.sourceUrl)! })}
              >
                {item.kind === 'link' ? 'Open ↗' : `from ${displayHost(item.sourceUrl!)} ↗`}
              </button>
            )}
            {selected === item.id && (
              <>
                <button className="easel-delete" title="Remove (⌫)" onPointerDown={(e) => e.stopPropagation()} onClick={() => remove(item.id)}>
                  <IconTrash width={13} height={13} />
                </button>
                <span className="easel-resize" onPointerDown={startDrag(item, 'resize')} />
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
