import { useEffect, useMemo, useState } from 'react'
import type { AppState, DownloadItem } from '../../../shared/types'
import { dispatch } from '../state'
import { groupByDay, timeLabel } from './ArchivePanel'
import { IconClose, IconFolderOpen, IconSearch, IconTrash } from './Icons'

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  const units = ['KB', 'MB', 'GB']
  let value = n / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[i]}`
}

function status(d: DownloadItem): string {
  if (d.state === 'progressing') {
    return d.total ? `${formatBytes(d.received)} of ${formatBytes(d.total)}` : formatBytes(d.received)
  }
  if (d.state === 'completed') return formatBytes(d.total || d.received)
  return d.state === 'cancelled' ? 'Cancelled' : 'Failed'
}

/** A thumbnail of the file (pictures, PDFs, …) or its Finder icon; the file type as a fallback. */
function FileIcon({ d }: { d: DownloadItem }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let stale = false
    if (d.state === 'completed') window.vaia.downloadThumbnail(d.id).then((url) => !stale && setSrc(url))
    return () => {
      stale = true
    }
  }, [d.id, d.state])
  if (src) return <img className="download-thumb" src={src} alt="" />
  return <span className="download-icon">{(d.filename.split('.').pop() ?? '').slice(0, 4).toUpperCase() || 'FILE'}</span>
}

function ProgressBar({ d }: { d: DownloadItem }) {
  return (
    <span className="download-bar">
      <span style={{ width: d.total ? `${(100 * d.received) / d.total}%` : '30%' }} />
    </span>
  )
}

/** Hovering the downloads button: the last few downloads, right above it. */
export function DownloadsPopover({ state, onShowAll }: { state: AppState; onShowAll: () => void }) {
  const recent = state.downloads.slice(0, 4)
  return (
    <div className="downloads-popover" onMouseDown={(e) => e.stopPropagation()}>
      <div className="downloads-popover-head">
        <span>Downloads</span>
        <button className="text-button small" onClick={onShowAll}>
          Show All
        </button>
      </div>
      {recent.length === 0 && <div className="list-empty small">Files you download appear here.</div>}
      {recent.map((d) => (
        <div
          key={d.id}
          className={`download-row compact ${d.state}`}
          role="button"
          title={d.state === 'completed' ? 'Open' : d.url}
          onClick={() => d.state === 'completed' && dispatch({ type: 'download/open', id: d.id })}
        >
          <FileIcon d={d} />
          <span className="download-text">
            <span className="download-name">{d.filename}</span>
            <span className="download-status">{status(d)}</span>
            {d.state === 'progressing' && <ProgressBar d={d} />}
          </span>
        </div>
      ))}
    </div>
  )
}

/** The full Downloads page (⇧⌘J): searchable, grouped by day. */
export function DownloadsPanel({ state, closing, onClose }: { state: AppState; closing: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const items = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? state.downloads.filter((d) => `${d.filename} ${d.url}`.toLowerCase().includes(q)) : state.downloads
  }, [state.downloads, query])
  const groups = useMemo(() => groupByDay(items, (d) => d.startedAt), [items])

  return (
    <div className={`cmd-layer${closing ? ' closing' : ''}`} onMouseDown={onClose}>
      <div
        className="panel list-panel downloads-page"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
      >
        <div className="list-panel-head">
          <h2>Downloads</h2>
        </div>
        <div className="search-field">
          <IconSearch />
          <input autoFocus value={query} placeholder="Search downloads" onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="list-panel-body">
          {groups.length === 0 && (
            <div className="list-empty">{query ? 'Nothing matches your search.' : 'Files you download appear here.'}</div>
          )}
          {groups.map(([label, entries]) => (
            <section key={label}>
              <h3>{label}</h3>
              {entries.map((d) => (
                <div
                  key={d.id}
                  className={`download-row ${d.state}`}
                  role="button"
                  title={d.state === 'completed' ? `Open ${d.filename}` : d.url}
                  onClick={() => d.state === 'completed' && dispatch({ type: 'download/open', id: d.id })}
                >
                  <FileIcon d={d} />
                  <span className="download-text">
                    <span className="download-name">{d.filename}</span>
                    <span className="download-status">
                      {status(d)} · {timeLabel(d.startedAt)}
                    </span>
                    {d.state === 'progressing' && <ProgressBar d={d} />}
                  </span>
                  <span className="download-actions">
                    {d.state === 'progressing' ? (
                      <button
                        className="tab-action"
                        title="Cancel"
                        onClick={(e) => {
                          e.stopPropagation()
                          dispatch({ type: 'download/cancel', id: d.id })
                        }}
                      >
                        <IconClose />
                      </button>
                    ) : (
                      <>
                        {d.state === 'completed' && (
                          <button
                            className="tab-action"
                            title="Show in Finder"
                            onClick={(e) => {
                              e.stopPropagation()
                              dispatch({ type: 'download/show', id: d.id })
                            }}
                          >
                            <IconFolderOpen />
                          </button>
                        )}
                        <button
                          className="tab-action"
                          title={d.state === 'completed' ? 'Move the file to the Trash' : 'Remove from the list'}
                          onClick={(e) => {
                            e.stopPropagation()
                            dispatch({ type: d.state === 'completed' ? 'download/trash' : 'download/remove', id: d.id })
                          }}
                        >
                          {d.state === 'completed' ? <IconTrash /> : <IconClose />}
                        </button>
                      </>
                    )}
                  </span>
                </div>
              ))}
            </section>
          ))}
        </div>
        <div className="panel-footer">
          {state.downloads.some((d) => d.state !== 'progressing') && (
            <button className="text-button" onClick={() => dispatch({ type: 'downloads/clear' })}>
              Clear List
            </button>
          )}
          <button className="primary-button" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
