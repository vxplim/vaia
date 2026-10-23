import { useState } from 'react'
import type { Zone } from '../../../shared/tree'
import type { AppState, TabItem } from '../../../shared/types'
import { sameUrl } from '../../../shared/url'
import { useDragRow } from '../dnd'
import { tabMenu } from '../menus'
import { dispatch } from '../state'
import { Favicon } from './Favicon'
import { IconClose, IconReturn } from './Icons'

interface Props {
  tab: TabItem
  state: AppState
  active: boolean
  zone: Zone
  spaceId: string
  parentId: string | null
  index: number
  depth?: number
}

export function TabRow({ tab, state, active, zone, spaceId, parentId, index, depth = 0 }: Props) {
  const [closing, setClosing] = useState(false)
  const rt = state.runtime[tab.id]
  const loaded = !!rt
  const navigatedAway = !!tab.pinnedUrl && !!tab.url && !sameUrl(tab.url, tab.pinnedUrl)
  const { draggable, dropClass, dragging, handlers } = useDragRow({
    id: tab.id,
    kind: 'tab',
    url: tab.url,
    zone,
    spaceId,
    parentId,
    index
  })

  return (
    <div
      className={`tab-row${active ? ' active' : ''}${dragging ? ' dragging' : ''}${closing ? ' closing' : ''}${dropClass}`}
      style={{ paddingLeft: 10 + depth * 14 }}
      role="button"
      title={tab.url}
      draggable={draggable}
      {...handlers}
      onMouseDown={(e) => {
        if (e.button === 1) {
          e.preventDefault()
          dispatch({ type: 'tab/close', id: tab.id })
        }
      }}
      onClick={() => dispatch({ type: 'tab/activate', id: tab.id })}
      onContextMenu={(e) => {
        e.preventDefault()
        tabMenu(tab, zone, loaded, active)
      }}
    >
      <span className={`tab-icon${rt?.loading ? ' loading' : ''}`}>
        <Favicon src={tab.favicon} url={tab.url} />
      </span>
      <span className="tab-title">
        {navigatedAway && <span className="tab-slash">/</span>}
        {tab.title || tab.url || 'New Tab'}
      </span>
      {navigatedAway && (
        <button
          className="tab-action tab-return"
          title="Back to pinned page"
          onClick={(e) => {
            e.stopPropagation()
            dispatch({ type: 'tab/resetPinned', id: tab.id })
          }}
        >
          <IconReturn />
        </button>
      )}
      {(zone === 'today' || loaded) && (
        <button
          className="tab-action tab-close"
          title={zone === 'today' ? 'Close tab (⌘W)' : 'Put to sleep (stays pinned)'}
          onClick={(e) => {
            e.stopPropagation()
            if (zone !== 'today') return dispatch({ type: 'tab/close', id: tab.id })
            // Let the row fold away before it's removed.
            setClosing(true)
            setTimeout(() => dispatch({ type: 'tab/close', id: tab.id }), 150)
          }}
        >
          <IconClose />
        </button>
      )}
    </div>
  )
}
