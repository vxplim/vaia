import { useEffect, useMemo, useState } from 'react'
import type { HistoryEntry } from '../../../shared/types'
import { displayHost } from '../../../shared/url'
import { dispatch } from '../state'
import { groupByDay, timeLabel } from './ArchiveView'
import { Favicon } from './Favicon'
import { IconClose, IconSearch } from './Icons'

/** Every site you've visited, newest first, grouped by day and searchable. */
export function HistoryPanel({ closing, onClose }: { closing: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<HistoryEntry[]>([])
  const [version, setVersion] = useState(0)
  const [confirmClear, setConfirmClear] = useState(false)

  useEffect(() => {
    let stale = false
    window.vaia.listHistory(query).then((list) => !stale && setItems(list))
    return () => {
      stale = true
    }
  }, [query, version])

  const groups = useMemo(() => groupByDay(items, (h) => h.visitedAt), [items])

  return (
    <div className={`cmd-layer${closing ? ' closing' : ''}`} onMouseDown={onClose}>
      <div
        className="panel list-panel"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
      >
        <div className="list-panel-head">
          <h2>History</h2>
        </div>
        <div className="search-field">
          <IconSearch />
          <input autoFocus value={query} placeholder="Search history" onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="list-panel-body">
          {groups.length === 0 && (
            <div className="list-empty">{query ? 'Nothing matches your search.' : 'Sites you visit will appear here.'}</div>
          )}
          {groups.map(([label, entries]) => (
            <section key={label}>
              <h3>{label}</h3>
              {entries.map((h) => (
                <div
                  key={h.url}
                  className="list-row"
                  role="button"
                  title={h.url}
                  onClick={() => {
                    onClose()
                    dispatch({ type: 'tab/new', url: h.url })
                  }}
                >
                  <Favicon src={h.favicon} url={h.url} />
                  <span className="list-row-title">{h.title || h.url}</span>
                  <span className="list-row-meta">{displayHost(h.url)}</span>
                  <span className="list-row-time">{timeLabel(h.visitedAt)}</span>
                  <button
                    className="tab-action"
                    title="Remove from History"
                    onClick={(e) => {
                      e.stopPropagation()
                      dispatch({ type: 'history/remove', url: h.url }).then(() => setVersion((v) => v + 1))
                    }}
                  >
                    <IconClose />
                  </button>
                </div>
              ))}
            </section>
          ))}
        </div>
        <div className="panel-footer">
          {items.length > 0 && !query && (
            <button
              className="text-button danger"
              onClick={() => {
                if (!confirmClear) return setConfirmClear(true)
                dispatch({ type: 'data/clear', history: true }).then(() => setVersion((v) => v + 1))
                setConfirmClear(false)
              }}
            >
              {confirmClear ? 'Click again to clear all history' : 'Clear History'}
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
