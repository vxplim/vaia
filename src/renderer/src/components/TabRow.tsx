import { useEffect, useRef, useState } from 'react'
import { tabLabel, unreadCount, type Zone } from '../../../shared/tree'
import type { AppState, TabItem } from '../../../shared/types'
import { sameUrl } from '../../../shared/url'
import { useDragRow } from '../dnd'
import { tabMenu } from '../menus'
import { dispatch } from '../state'
import { Favicon } from './Favicon'
import { IconClose, IconReturn, IconSpeaker, IconSpeakerOff } from './Icons'

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

/** Speaker on a tab that's playing sound (or muted): click to mute / unmute. */
export function SoundButton({ tabId, audible, muted }: { tabId: string; audible?: boolean; muted?: boolean }) {
  if (!audible && !muted) return null
  return (
    <button
      className={`tab-sound${muted ? ' muted' : ''}`}
      title={muted ? 'Unmute tab' : 'Mute tab'}
      onClick={(e) => {
        e.stopPropagation()
        dispatch({ type: 'tab/mute', id: tabId, muted: !muted })
      }}
    >
      {muted ? <IconSpeakerOff width={13} height={13} /> : <IconSpeaker width={13} height={13} />}
    </button>
  )
}

export function TabRow({ tab, state, active, zone, spaceId, parentId, index, depth = 0 }: Props) {
  const [closing, setClosing] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState('')
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (renaming) requestAnimationFrame(() => input.current?.select())
  }, [renaming])
  const startRename = () => {
    setName(tabLabel(tab))
    setRenaming(true)
  }
  const commitRename = () => {
    setRenaming(false)
    const next = name.trim()
    // Typing the page's own title back in is the same as resetting the name.
    if (next && next !== tabLabel(tab)) dispatch({ type: 'tab/rename', id: tab.id, name: next === tab.title ? null : next })
  }
  // Pinned tabs show the page's unread count, e.g. "(3) Inbox".
  const unread = zone === 'pinned' ? unreadCount(tab.title) : 0
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
      title={tab.customName || tab.name ? `${tab.title}\n${tab.url}` : tab.url}
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
        tabMenu(tab, zone, loaded, active, startRename)
      }}
    >
      <span className={`tab-icon${rt?.loading ? ' loading' : ''}`}>
        <Favicon src={tab.favicon} url={tab.url} />
        {tab.unread && <span className="unread-dot" title="New post" />}
      </span>
      {renaming ? (
        <input
          ref={input}
          className="tab-rename"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onBlur={commitRename}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Enter') commitRename()
            if (e.key === 'Escape') setRenaming(false)
          }}
        />
      ) : (
        <span
          className="tab-title"
          onDoubleClick={(e) => {
            e.stopPropagation()
            startRename()
          }}
        >
          {navigatedAway && <span className="tab-slash">/</span>}
          {tabLabel(tab)}
        </span>
      )}
      <SoundButton tabId={tab.id} audible={rt?.audible} muted={rt?.muted} />
      {unread > 0 && <span className="unread-badge">{unread > 99 ? '99+' : unread}</span>}
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
