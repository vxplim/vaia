import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AppState, MediaItem, MediaList } from '../../../shared/types'
import { dispatch } from '../state'
import { formatBytes } from './DownloadsView'
import { IconBack, IconClose, IconFolderOpen, IconForward, IconSearch, IconTrash } from './Icons'

/** The address the interface uses to show a listed file (served by the brain, see media.ts). */
const fileUrl = (path: string) => `vaia-media://file/${encodeURIComponent(path)}`

/** A Quick Look picture, loaded only once the tile scrolls into view. */
function Thumb({ item, size }: { item: MediaItem; size: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [src, setSrc] = useState<string | null>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => entry.isIntersecting && setVisible(true), { rootMargin: '200px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  useEffect(() => {
    let stale = false
    if (visible) window.vaia.mediaThumbnail(item.path, size).then((url) => !stale && setSrc(url))
    return () => {
      stale = true
    }
  }, [visible, item.path, size])
  return (
    <div className="media-thumb" ref={ref}>
      {src ? <img src={src} alt="" draggable={false} /> : <span className="media-ext">{item.name.split('.').pop()?.toUpperCase()}</span>}
      {item.kind !== 'image' && <span className="media-badge">{item.kind === 'video' ? '▶' : 'PDF'}</span>}
    </div>
  )
}

/** One file, shown large, with what you can do with it. ← → step through the grid. */
function Preview({
  item,
  onClose,
  onStep,
  onDeleted
}: {
  item: MediaItem
  onClose: () => void
  onStep: (delta: 1 | -1) => void
  onDeleted: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pdfPicture, setPdfPicture] = useState<string | null>(null)
  useEffect(() => ref.current?.focus(), [item.path])
  useEffect(() => {
    let stale = false
    setPdfPicture(null)
    if (item.kind === 'pdf') window.vaia.mediaThumbnail(item.path, 1400).then((url) => !stale && setPdfPicture(url))
    return () => {
      stale = true
    }
  }, [item.path, item.kind])
  const act = (type: 'media/open' | 'media/show' | 'media/copy') => dispatch({ type, path: item.path })
  return (
    <div
      className="media-preview"
      ref={ref}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          onClose()
        }
        if (e.key === 'ArrowLeft') onStep(-1)
        if (e.key === 'ArrowRight') onStep(1)
      }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="media-preview-bar">
        <button className="icon-button" title="Back to all media (Esc)" onClick={onClose}>
          <IconClose />
        </button>
        <span className="media-preview-name" title={item.path}>
          {item.name}
          <small>
            {formatBytes(item.size)} · {new Date(item.time).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
            {item.source === 'screenshot' ? ' · Screenshot' : ''}
          </small>
        </span>
        <button className="text-button" onClick={() => act('media/open')}>
          Open
        </button>
        <button className="text-button" onClick={() => act('media/show')}>
          <IconFolderOpen /> Show in Finder
        </button>
        <button className="text-button" onClick={() => act('media/copy')}>
          Copy
        </button>
        <button
          className="text-button danger"
          title="Move the file to the Trash"
          onClick={() => dispatch({ type: 'media/trash', path: item.path }).then(onDeleted)}
        >
          <IconTrash /> Delete
        </button>
      </div>
      <div className="media-stage" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <button className="media-step left" title="Previous (←)" onClick={() => onStep(-1)}>
          <IconBack />
        </button>
        {item.kind === 'image' && <img src={fileUrl(item.path)} alt={item.name} draggable={false} />}
        {item.kind === 'video' && <video key={item.path} src={fileUrl(item.path)} controls autoPlay />}
        {item.kind === 'pdf' && (pdfPicture ? <img src={pdfPicture} alt={item.name} /> : <div className="list-empty">Loading…</div>)}
        <button className="media-step right" title="Next (→)" onClick={() => onStep(1)}>
          <IconForward />
        </button>
      </div>
    </div>
  )
}

/** Library → Media: downloaded pictures, videos and PDFs (and, if you like, your screenshots). */
export function MediaView({ state }: { state: AppState }) {
  const [list, setList] = useState<MediaList | null>(null)
  const [query, setQuery] = useState('')
  const [openPath, setOpenPath] = useState<string | null>(null)
  const screenshots = state.settings.mediaScreenshots
  // Look again when a download finishes or a file is deleted.
  const downloadsKey = state.downloads.map((d) => `${d.id}:${d.state}`).join(',')
  const reload = useCallback(() => window.vaia.listMedia().then(setList), [])
  useEffect(() => {
    reload()
  }, [reload, downloadsKey, screenshots])
  // Coming back to VAIA (e.g. after allowing access in System Settings, or taking a screenshot).
  useEffect(() => {
    window.addEventListener('focus', reload)
    return () => window.removeEventListener('focus', reload)
  }, [reload])

  const items = useMemo(() => {
    const q = query.trim().toLowerCase()
    const all = list?.items ?? []
    return q ? all.filter((i) => i.name.toLowerCase().includes(q)) : all
  }, [list, query])
  const index = items.findIndex((i) => i.path === openPath)
  const open = index >= 0 ? items[index] : null
  const step = (delta: 1 | -1) => items.length && setOpenPath(items[(index + delta + items.length) % items.length].path)

  // After deleting, show the next file (or go back to the grid).
  const listRef = useRef(items)
  useEffect(() => {
    if (openPath && index < 0) {
      const old = listRef.current.findIndex((i) => i.path === openPath)
      setOpenPath(items[Math.min(old, items.length - 1)]?.path ?? null)
    }
    listRef.current = items
  }, [items, openPath, index])

  return (
    <div className="library-section media-section">
      <div className="list-panel-head">
        <h2>Media</h2>
        <label className="inline-select">
          <input
            type="checkbox"
            checked={screenshots}
            onChange={(e) => dispatch({ type: 'settings/update', patch: { mediaScreenshots: e.target.checked } })}
          />
          Include my Mac screenshots
        </label>
      </div>
      <div className="search-field">
        <IconSearch />
        <input autoFocus value={query} placeholder="Search media" onChange={(e) => setQuery(e.target.value)} />
      </div>
      {list?.screenshotsBlocked && (
        <div className="media-notice">
          <span>
            VAIA can’t see your screenshots folder{list.screenshotsFolder ? ` (${list.screenshotsFolder.replace(/^\/Users\/[^/]+/, '~')})` : ''}.
            To show screenshots here, allow VAIA in System Settings → Privacy &amp; Security → Files &amp; Folders, then come back.
          </span>
          <button className="text-button" onClick={() => dispatch({ type: 'media/openPrivacySettings' })}>
            Open Privacy Settings
          </button>
        </div>
      )}
      <div className="list-panel-body">
        {list && items.length === 0 && (
          <div className="list-empty">
            {query
              ? 'Nothing matches your search.'
              : `Pictures, videos and PDFs you download${screenshots ? ', and your screenshots,' : ''} appear here.`}
          </div>
        )}
        <div className="media-grid">
          {items.map((item) => (
            <button key={item.path} className="media-tile" title={item.name} onClick={() => setOpenPath(item.path)}>
              <Thumb item={item} size={320} />
              <span className="media-name">{item.name}</span>
            </button>
          ))}
        </div>
      </div>
      {open && <Preview item={open} onClose={() => setOpenPath(null)} onStep={step} onDeleted={reload} />}
    </div>
  )
}
