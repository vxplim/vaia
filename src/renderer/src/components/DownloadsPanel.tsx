import type { AppState, DownloadItem } from '../../../shared/types'
import { dispatch } from '../state'
import { IconClose, IconFolderOpen } from './Icons'

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

/** A small popover with your recent downloads. */
export function DownloadsPanel({ state, closing, onClose }: { state: AppState; closing: boolean; onClose: () => void }) {
  return (
    <div className={`overlay-layer light${closing ? ' closing' : ''}`} onMouseDown={onClose}>
      <div
        className="panel downloads-panel"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        tabIndex={-1}
        ref={(el) => el?.focus()}
      >
        <div className="downloads-head">
          <h2>Downloads</h2>
          {state.downloads.some((d) => d.state !== 'progressing') && (
            <button className="text-button" onClick={() => dispatch({ type: 'downloads/clear' })}>
              Clear
            </button>
          )}
        </div>
        {state.downloads.length === 0 && <div className="list-empty small">Files you download appear here.</div>}
        {state.downloads.map((d) => (
          <div
            key={d.id}
            className={`download-row ${d.state}`}
            role="button"
            title={d.state === 'completed' ? 'Open' : d.url}
            onClick={() => d.state === 'completed' && dispatch({ type: 'download/open', id: d.id })}
          >
            <span className="download-icon">{(d.filename.split('.').pop() ?? '').slice(0, 4).toUpperCase() || 'FILE'}</span>
            <span className="download-text">
              <span className="download-name">{d.filename}</span>
              <span className="download-status">{status(d)}</span>
              {d.state === 'progressing' && (
                <span className="download-bar">
                  <span style={{ width: d.total ? `${(100 * d.received) / d.total}%` : '30%' }} />
                </span>
              )}
            </span>
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
              d.state === 'completed' && (
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
              )
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
