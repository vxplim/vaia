import { useEffect, useMemo, useState } from 'react'
import type { AppState, ArchiveAfter, ArchivedTab } from '../../../shared/types'
import { displayHost } from '../../../shared/url'
import { dispatch } from '../state'
import { Favicon } from './Favicon'
import { IconClose, IconSearch } from './Icons'

const ARCHIVE_OPTIONS: { value: ArchiveAfter; label: string }[] = [
  { value: '12h', label: '12 hours' },
  { value: '24h', label: '24 hours' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: 'never', label: 'Never' }
]

export function dayLabel(time: number): string {
  const day = new Date(time)
  day.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((today.getTime() - day.getTime()) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return day.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
}

export function timeLabel(time: number): string {
  return new Date(time).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

/** Group items by calendar day, newest first. */
export function groupByDay<T>(items: T[], timeOf: (item: T) => number): [string, T[]][] {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const label = dayLabel(timeOf(item))
    if (!groups.has(label)) groups.set(label, [])
    groups.get(label)!.push(item)
  }
  return [...groups]
}

interface Props {
  state: AppState
  closing: boolean
  onClose: () => void
}

/** Tabs that were closed or tidied away, grouped by day, searchable, and reopenable. */
export function ArchivePanel({ state, closing, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<ArchivedTab[]>([])
  const [confirmClear, setConfirmClear] = useState(false)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let stale = false
    window.vaia.listArchive(query).then((list) => !stale && setItems(list.slice(0, 500)))
    return () => {
      stale = true
    }
  }, [query, version])

  const groups = useMemo(() => groupByDay(items, (a) => a.archivedAt), [items])
  const spaceName = (id: string) => state.spaces.find((s) => s.id === id)

  return (
    <div className={`cmd-layer${closing ? ' closing' : ''}`} onMouseDown={onClose}>
      <div
        className="panel list-panel"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
      >
        <div className="list-panel-head">
          <h2>Archive</h2>
          <label className="inline-select">
            Auto-archive Today tabs after
            <select
              value={state.settings.archiveAfter}
              onChange={(e) =>
                dispatch({ type: 'settings/update', patch: { archiveAfter: e.target.value as ArchiveAfter } })
              }
            >
              {ARCHIVE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="search-field">
          <IconSearch />
          <input autoFocus value={query} placeholder="Search the Archive" onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="list-panel-body">
          {groups.length === 0 && (
            <div className="list-empty">
              {query ? 'Nothing matches your search.' : 'Closed and auto-archived tabs will appear here.'}
            </div>
          )}
          {groups.map(([label, entries]) => (
            <section key={label}>
              <h3>{label}</h3>
              {entries.map((a) => {
                const space = spaceName(a.spaceId)
                return (
                  <div
                    key={a.id + a.archivedAt}
                    className="list-row"
                    role="button"
                    title={`Reopen ${a.url}`}
                    onClick={() => {
                      onClose()
                      dispatch({ type: 'archive/restore', id: a.id })
                    }}
                  >
                    <Favicon src={a.favicon} url={a.url} />
                    <span className="list-row-title">{a.title || a.url}</span>
                    <span className="list-row-meta">
                      {displayHost(a.url)}
                      {space && state.spaces.length > 1 ? ` · ${space.icon} ${space.name}` : ''}
                    </span>
                    <span className="list-row-time">{timeLabel(a.archivedAt)}</span>
                    <button
                      className="tab-action"
                      title="Remove from Archive"
                      onClick={(e) => {
                        e.stopPropagation()
                        dispatch({ type: 'archive/remove', id: a.id }).then(() => setVersion((v) => v + 1))
                      }}
                    >
                      <IconClose />
                    </button>
                  </div>
                )
              })}
            </section>
          ))}
        </div>
        <div className="panel-footer">
          {items.length > 0 && !query && (
            <button
              className="text-button danger"
              onClick={() => {
                if (!confirmClear) return setConfirmClear(true)
                dispatch({ type: 'archive/clear' }).then(() => setVersion((v) => v + 1))
                setConfirmClear(false)
              }}
            >
              {confirmClear ? 'Click again to clear everything' : 'Clear Archive'}
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
