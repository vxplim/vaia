// The Mini Player (?view=mini): a small card floating in a corner of the page area
// for a tab you left while it was playing, or while you were in a call.
import { useEffect } from 'react'
import { locate, tabLabel } from '../../shared/tree'
import { displayHost } from '../../shared/url'
import { Favicon } from './components/Favicon'
import { IconClose, IconExpand, IconPause, IconPlay, IconPopout, IconSpeaker, IconSpeakerOff } from './components/Icons'
import { dispatch, useAppState } from './state'
import { useSystemDark } from './theme'

export function MiniApp() {
  const state = useAppState()
  const dark = useSystemDark()
  // Let go of the mouse anywhere over the player: it settles in the nearest corner.
  useEffect(() => {
    const up = () => dispatch({ type: 'mini/dragEnd' })
    window.addEventListener('mouseup', up)
    return () => window.removeEventListener('mouseup', up)
  }, [])
  const mini = state?.mini
  const loc = mini && state ? locate(state, mini.tabId) : null
  const tab = loc?.item.kind === 'tab' ? loc.item : loc?.split?.tabs.find((t) => t.id === mini?.tabId)
  if (!state || !mini || !tab) return null
  const muted = !!state.runtime[tab.id]?.muted

  return (
    <div
      className={`mini-player${dark ? ' dark' : ''}`}
      onMouseDown={(e) => {
        // Drag the player by anything that isn't a button.
        if (e.button === 0 && !(e.target as Element).closest('button')) dispatch({ type: 'mini/dragStart' })
      }}
    >
      <Favicon src={tab.favicon} url={tab.url} size={20} />
      <div className="mini-text" title={tab.title}>
        <span className="mini-title">{tabLabel(tab)}</span>
        <span className="mini-sub">{mini.call ? 'Call in progress' : displayHost(tab.url)}</span>
      </div>
      {!mini.call && (
        <button className="mini-button" title={mini.playing ? 'Pause' : 'Play'} onClick={() => dispatch({ type: 'mini/playPause' })}>
          {mini.playing ? <IconPause /> : <IconPlay />}
        </button>
      )}
      <button className="mini-button" title={muted ? 'Unmute' : 'Mute'} onClick={() => dispatch({ type: 'tab/mute', id: tab.id, muted: !muted })}>
        {muted ? <IconSpeakerOff /> : <IconSpeaker />}
      </button>
      {mini.video && !mini.call && (
        <button className="mini-button" title="Picture in picture" onClick={() => dispatch({ type: 'mini/pip' })}>
          <IconPopout />
        </button>
      )}
      <button className="mini-button" title={mini.call ? 'Back to the call' : 'Back to the tab'} onClick={() => dispatch({ type: 'mini/back' })}>
        <IconExpand />
      </button>
      <button className="mini-button" title={mini.call ? 'Hide (the call keeps going)' : 'Close (pauses)'} onClick={() => dispatch({ type: 'mini/close' })}>
        <IconClose />
      </button>
    </div>
  )
}
